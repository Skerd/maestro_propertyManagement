/**
 * Imports a mongodump archive of an older Arpeggio deployment (Pronix) into this database, under one target company
 * (D171). The target database is the one the MONGODB_* environment names, as for every maestro script.
 *
 * Usage (from maestro/):
 *   nice -n 19 npx ts-node --transpile-only -r tsconfig-paths/register \
 *     modules/propertyManagement/scripts/legacyImport/importLegacyArchive.ts \
 *     --archive ../live/pronix/backups/pronix_2026-11-18_21-09-43.archive.gz --target-company <id | VAT | name>
 *
 *   (no flag)                 dry run: reads, maps, converts and validates everything, writes nothing, saves the report
 *   --execute                 also writes, verifies every row and file against the plan, rolls back on any failure
 *   --yes                     with --execute: skip typing the database name to confirm
 *   --timezone <IANA zone>    the zone a timed old value's calendar day is taken in (default: the target company's)
 *   --report-dir <dir>        where the report and journal go (default: <archive folder>/../imports/<time>)
 *   --rollback <journal>      undo a run: <report dir>/journal.ndjson
 *
 * LEGACY_ENCRYPTION_KEY: the old instance's ENCRYPTION_KEY, when it differs from this one's (chat messages and the
 * mail server password are re-encrypted with this instance's key).
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {connectToMongoDb, mongooseInstance} from "@coreModule/connections/connectToMongoDb";
import {asCrossTenant} from "@coreModule/utilities/endpoints/tenantScope";
import {ENCRYPTION_KEY, MONGO_DB} from "@coreModule/environment";
import {BSON} from "./archiveReader";
import {buildPlan, ImportOptions, ImportPlan, loadSource} from "./legacyImportPlan";
import {executePlan, Journal, Log, rollback, verifyWrites} from "./legacyImportWriter";
import {RETIRED_COLLECTIONS} from "./legacyTransforms";

export interface RunOptions extends ImportOptions {
    execute: boolean;
    reportDir: string;
    log?: Log;
}

export interface RunResult {
    ok: boolean;
    plan: ImportPlan;
    reportDir: string;
    /** Set when the run wrote and then had to undo its writes. */
    rolledBack: boolean;
    failures: string[];
}

const timestamp = (): string => new Date().toISOString().slice(11, 19);
/** Plain CLI output (an operator reads it in the terminal; the core logger's format is for servers). */
const print = (text: string): void => {
    process.stdout.write(`${text}\n`);
};
const printError = (text: string): void => {
    process.stderr.write(`${text}\n`);
};
const defaultLog: Log = (message) => print(`${timestamp()}  ${message}`);

/** Plans, reports and (with `execute`) writes and verifies one import. */
export async function runLegacyImport(options: RunOptions): Promise<RunResult> {
    const log = options.log ?? defaultLog;
    fs.mkdirSync(options.reportDir, {recursive: true});

    log(`Reading ${options.archivePath}…`);
    const source = await loadSource(options.archivePath);
    const decoded = [...source.docs.values()].reduce((sum, docs) => sum + docs.length, 0);
    log(`Archive of database "${source.database}" (MongoDB ${source.summary.serverVersion}): ${source.summary.counts.size} non-empty collections, ${decoded} documents decoded, ${source.chunkCount} file chunks fingerprinted.`);

    log("Planning: mapping, converting and validating every document…");
    const plan = await buildPlan(options, source);
    writeSkipped(plan, options.reportDir);

    if (plan.errors.length > 0 || !options.execute) {
        writeReport(plan, options.reportDir, {mode: options.execute ? "execute (refused)" : "dry run", failures: [], rolledBack: false});
        log(plan.errors.length > 0 ? `${plan.errors.length} problems found; nothing was written. See ${path.join(options.reportDir, "report.md")}` : `Dry run clean: nothing written. Report: ${path.join(options.reportDir, "report.md")}`);
        return {ok: plan.errors.length === 0, plan, reportDir: options.reportDir, rolledBack: false, failures: []};
    }

    const journal = new Journal(path.join(options.reportDir, "journal.ndjson"));
    let failures: string[] = [];
    try {
        const result = await executePlan(plan, journal, log);
        log("Verifying what was written…");
        failures = await verifyWrites(plan, result, log);
        if (failures.length > 0) throw new Error(`${failures.length} verification failures`);
    } catch (error) {
        failures = failures.length > 0 ? failures : [error instanceof Error ? error.message : String(error)];
        log(`Import failed (${failures[0]}); rolling back every write…`);
        await rollback(journal.file, log);
        writeReport(plan, options.reportDir, {mode: "execute (failed, rolled back)", failures, rolledBack: true});
        return {ok: false, plan, reportDir: options.reportDir, rolledBack: true, failures};
    }
    writeReport(plan, options.reportDir, {mode: "execute (written and verified)", failures: [], rolledBack: false});
    log(`Import complete and verified. Report: ${path.join(options.reportDir, "report.md")}. Undo with --rollback ${journal.file}`);
    return {ok: true, plan, reportDir: options.reportDir, rolledBack: false, failures: []};
}

/** The documents that are not imported but are not in the archive's telemetry either, saved beside the report. */
function writeSkipped(plan: ImportPlan, reportDir: string): void {
    const dir = path.join(reportDir, "skipped");
    fs.mkdirSync(dir, {recursive: true});
    const save = (name: string, docs: unknown[]): void => {
        if (docs.length > 0) fs.writeFileSync(path.join(dir, `${name}.ndjson`), docs.map((doc) => BSON.EJSON.stringify(doc, {relaxed: false})).join("\n") + "\n");
    };
    for (const collection of RETIRED_COLLECTIONS.keys()) save(collection, plan.source.docs.get(collection) ?? []);
    for (const collection of ["countries", "states", "cities", "rolepermissions"]) {
        const skipped = new Set(plan.ledger.idsWith(collection, "skipped"));
        save(`${collection}-not-imported`, (plan.source.docs.get(collection) ?? []).filter((doc) => skipped.has(String(doc._id))));
    }
}

function writeReport(plan: ImportPlan, reportDir: string, outcome: {mode: string; failures: string[]; rolledBack: boolean}): void {
    const ledger = plan.ledger.table(plan.source.summary.counts);
    const target = plan.target.company;
    const json = {
        mode: outcome.mode,
        archive: plan.options.archivePath,
        sourceDatabase: plan.source.database,
        targetDatabase: MONGO_DB.DB_NAME,
        target: {companyId: String(target._id), name: target.name, timeZone: plan.target.timeZone, platformCompanyId: String(plan.target.platformId)},
        errors: plan.errors,
        failures: outcome.failures,
        rolledBack: outcome.rolledBack,
        ledger,
        notes: Object.fromEntries(plan.notes),
        idRemaps: plan.idRemaps,
        conversions: plan.conversions,
        moneyTotals: plan.moneyTotals,
    };
    fs.writeFileSync(path.join(reportDir, "report.json"), JSON.stringify(json, null, 2));

    const lines: string[] = [];
    lines.push(`# Pronix legacy import — ${outcome.mode}`, "");
    lines.push(`- Archive: \`${plan.options.archivePath}\` (database \`${plan.source.database}\`, MongoDB ${plan.source.summary.serverVersion})`);
    lines.push(`- Target database: \`${MONGO_DB.DB_NAME}\``);
    lines.push(`- Target company: **${target.name}** (\`${target._id}\`), calendar days in ${plan.target.timeZone}`);
    lines.push(`- Written: ${new Date().toISOString()}`, "");
    if (plan.errors.length > 0) {
        lines.push(`## ${plan.errors.length} problems (nothing was written)`, "");
        for (const error of plan.errors) lines.push(`- ${error}`);
        lines.push("");
    }
    if (outcome.failures.length > 0) {
        lines.push(`## Failed${outcome.rolledBack ? " and rolled back" : ""}`, "");
        for (const failure of outcome.failures) lines.push(`- ${failure}`);
        lines.push("");
    }
    lines.push("## Every source document accounted for", "");
    lines.push("| Collection | In archive | Imported | Merged into existing | Not imported | Why |", "|---|---:|---:|---:|---:|---|");
    for (const row of ledger) lines.push(`| ${row.collection} | ${row.source} | ${row.inserted} | ${row.merged} | ${row.skipped} | ${row.note} |`);
    const totals = ledger.reduce((sum, row) => ({source: sum.source + row.source, inserted: sum.inserted + row.inserted, merged: sum.merged + row.merged, skipped: sum.skipped + row.skipped}), {source: 0, inserted: 0, merged: 0, skipped: 0});
    lines.push(`| **Total** | **${totals.source}** | **${totals.inserted}** | **${totals.merged}** | **${totals.skipped}** | |`, "");
    lines.push("## Money totals per currency (archive = imported)", "");
    lines.push("| Amount | Archive | Imported |", "|---|---:|---:|");
    for (const key of Object.keys(plan.moneyTotals.source)) lines.push(`| ${key} | ${plan.moneyTotals.source[key]} | ${plan.moneyTotals.imported[key] ?? "—"} |`);
    lines.push("");
    for (const [section, entries] of plan.notes) {
        lines.push(`## ${section}`, "");
        for (const entry of entries) lines.push(entry.startsWith("  ") ? `    - ${entry.trim()}` : `- ${entry}`);
        lines.push("");
    }
    if (outcome.mode.startsWith("execute (written")) {
        lines.push("## Undo", "", "```", `npx ts-node --transpile-only -r tsconfig-paths/register modules/propertyManagement/scripts/legacyImport/importLegacyArchive.ts --rollback ${path.join(reportDir, "journal.ndjson")}`, "```", "");
    }
    fs.writeFileSync(path.join(reportDir, "report.md"), lines.join("\n"));
}

// ------------------------------------------------------------------------------------------------ CLI

interface CliArgs {
    archive?: string;
    targetCompany?: string;
    timeZone?: string;
    reportDir?: string;
    rollback?: string;
    execute: boolean;
    yes: boolean;
    help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = {execute: false, yes: false, help: false};
    const valueOf = (index: number, flag: string): string => {
        const inline = argv[index].includes("=") ? argv[index].slice(argv[index].indexOf("=") + 1) : argv[index + 1];
        if (!inline || inline.startsWith("--")) throw new Error(`${flag} needs a value`);
        return inline;
    };
    for (let index = 0; index < argv.length; index += 1) {
        const [flag] = argv[index].split("=");
        const takesNext = !argv[index].includes("=");
        switch (flag) {
            case "--archive": args.archive = valueOf(index, flag); if (takesNext) index += 1; break;
            case "--target-company": args.targetCompany = valueOf(index, flag); if (takesNext) index += 1; break;
            case "--timezone": args.timeZone = valueOf(index, flag); if (takesNext) index += 1; break;
            case "--report-dir": args.reportDir = valueOf(index, flag); if (takesNext) index += 1; break;
            case "--rollback": args.rollback = valueOf(index, flag); if (takesNext) index += 1; break;
            case "--execute": args.execute = true; break;
            case "--yes": args.yes = true; break;
            case "-h": case "--help": args.help = true; break;
            default: throw new Error(`Unknown option ${argv[index]} (try --help)`);
        }
    }
    return args;
}

function usage(): void {
    const source = fs.readFileSync(__filename, "utf8");
    const header = source.slice(source.indexOf("/**") + 3, source.indexOf("*/"));
    print(header.split("\n").map((line) => line.replace(/^ \* ?/, "")).join("\n"));
}

async function confirm(database: string): Promise<boolean> {
    if (!process.stdin.isTTY) return false;
    const prompt = readline.createInterface({input: process.stdin, output: process.stdout});
    const answer = await new Promise<string>((resolve) => prompt.question(`This writes into database "${database}". Type its name to continue: `, resolve));
    prompt.close();
    return answer.trim() === database;
}

async function main(): Promise<number> {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        usage();
        return 0;
    }
    if (!args.rollback && (!args.archive || !args.targetCompany)) {
        usage();
        printError("--archive and --target-company are required (or --rollback <journal>).");
        return 1;
    }
    const database = String(MONGO_DB.DB_NAME);
    if ((args.execute || args.rollback) && !args.yes && !(await confirm(database))) {
        printError("Not confirmed; nothing written. Pass --yes to skip the prompt.");
        return 1;
    }

    await connectToMongoDb(undefined, false);
    if (args.rollback) {
        defaultLog(`Rolling back ${args.rollback} in database "${database}"…`);
        await rollback(path.resolve(args.rollback), defaultLog);
        defaultLog("Rollback complete.");
        return 0;
    }

    const archivePath = path.resolve(String(args.archive));
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const reportDir = path.resolve(args.reportDir ?? path.join(path.dirname(archivePath), "..", "imports", `${stamp}-${args.execute ? "execute" : "dryrun"}`));
    defaultLog(`Target database "${database}"; report folder ${reportDir}`);
    const result = await runLegacyImport({
        archivePath,
        targetCompany: String(args.targetCompany),
        timeZone: args.timeZone,
        legacyEncryptionKey: process.env.LEGACY_ENCRYPTION_KEY || ENCRYPTION_KEY,
        targetEncryptionKey: ENCRYPTION_KEY,
        execute: args.execute,
        reportDir,
    });
    for (const error of result.plan.errors.slice(0, 20)) printError(`  - ${error}`);
    if (result.plan.errors.length > 20) printError(`  … and ${result.plan.errors.length - 20} more in report.md`);
    return result.ok ? 0 : 1;
}

if (require.main === module) {
    // The import writes the target company, its sub-companies and the platform lists (D16 cross-company operator script).
    asCrossTenant("a legacy import writes the target company, its sub-companies and the platform lists (D171)", main)
        .then(async (code) => {
            await mongooseInstance.disconnect();
            process.exit(code);
        })
        .catch(async (error: unknown) => {
            printError(`importLegacyArchive failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
            try {
                await mongooseInstance.disconnect();
            } catch {
                /* already closed */
            }
            process.exit(1);
        });
}
