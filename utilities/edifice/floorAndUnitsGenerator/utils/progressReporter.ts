import fs from 'fs';
import path from 'path';
import type {OcrSummary} from '../types';

type PageRecord = {
    pageNumber: number;
    classification: 'floor' | 'unit';
    floorLabel: string;
    unitName?: string;
    rectangleCount: number;
    warning?: string;
};

type PolygonRecord = {
    unitName: string;
    floorKey: string;
    success: boolean;
    pointCount?: number;
    registeredToMaster?: boolean;
};

type ProgressData = {
    total: number;
    processed: number;
    done: boolean;
    pages: PageRecord[];
    polygons: PolygonRecord[];
    summary?: OcrSummary;
};

export class ProgressReporter {
    private total: number;
    private pages: PageRecord[] = [];
    private polygons: PolygonRecord[] = [];
    private done = false;
    private outputRoot: string;

    constructor(outputRoot: string, total: number) {
        this.outputRoot = outputRoot;
        this.total = total;
        this.writeShell();
        this.writeData();
    }

    reportPageComplete(
        pageNumber: number,
        info: {
            classification: 'floor' | 'unit';
            floorLabel: string;
            unitName?: string;
            rectangleCount: number;
            warning?: string;
        }
    ): void {
        this.pages.push({pageNumber, ...info});
        this.writeData();
    }

    reportPolygonResult(
        unitName: string,
        floorKey: string,
        success: boolean,
        pointCount?: number,
        registeredToMaster?: boolean
    ): void {
        this.polygons.push({unitName, floorKey, success, pointCount, registeredToMaster});
        this.writeData();
    }

    finish(summary: OcrSummary): void {
        this.done = true;
        this.writeData(summary);
    }

    private writeData(summary?: OcrSummary): void {
        const data: ProgressData = {
            total: this.total,
            processed: this.pages.length,
            done: this.done,
            pages: this.pages,
            polygons: this.polygons,
            summary,
        };
        try {
            fs.writeFileSync(
                path.join(this.outputRoot, 'progress-data.json'),
                JSON.stringify(data),
                'utf-8'
            );
        } catch {
            // non-fatal
        }
    }

    /** Written once at start — static HTML shell with inline polling JS. */
    private writeShell(): void {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PDF Pipeline Progress</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0f1117;color:#e2e8f0;padding:20px}
h1{font-size:1.3rem;font-weight:700;margin-bottom:16px;color:#f1f5f9}
h2{font-size:.85rem;font-weight:600;margin:24px 0 10px;color:#64748b;text-transform:uppercase;letter-spacing:.07em}
.progress-bar-wrap{background:#1e293b;border-radius:8px;height:10px;margin-bottom:8px;overflow:hidden}
.progress-bar-fill{height:100%;background:linear-gradient(90deg,#3b82f6,#6366f1);border-radius:8px;transition:width .5s ease}
.status-line{font-size:.82rem;color:#64748b;margin-bottom:22px}
.pages-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:32px}
.card{background:#1e293b;border-radius:10px;padding:10px;border:1px solid #1e293b;transition:border-color .2s}
.card:hover{border-color:#334155}
.card img{width:100%;border-radius:5px;display:block;margin-bottom:8px;background:#0f1117;aspect-ratio:4/3;object-fit:cover}
.card-label{font-size:.76rem;font-weight:600;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#cbd5e1}
.badge{display:inline-block;font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:4px;text-transform:uppercase;letter-spacing:.05em}
.badge-floor{background:#1d4ed8;color:#bfdbfe}
.badge-unit{background:#065f46;color:#a7f3d0}
.badge-warn{background:#78350f;color:#fde68a;margin-left:5px}
.card-meta{font-size:.7rem;color:#475569;margin-top:4px}
.poly-table{width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:32px}
.poly-table th{background:#1e293b;color:#64748b;padding:7px 10px;text-align:left;font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em}
.poly-table td{padding:6px 10px;border-bottom:1px solid #1e293b}
.poly-table tr:hover td{background:#ffffff08}
.ok{color:#34d399}.fail{color:#f87171}.na{color:#475569}
.sum-floor{background:#1e293b;border-radius:8px;padding:12px;margin-bottom:10px;border:1px solid #1e293b}
.sum-floor h3{font-size:.84rem;font-weight:700;color:#93c5fd;margin-bottom:8px}
.sum-unit-list{display:flex;flex-wrap:wrap;gap:5px}
.sum-unit{font-size:.72rem;background:#0f172a;border:1px solid #334155;border-radius:4px;padding:2px 7px;color:#94a3b8}
#done-badge{display:none;background:#14532d;color:#86efac;font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:20px;margin-left:10px;vertical-align:middle}
</style>
</head>
<body>
<h1>PDF Pipeline Progress <span id="done-badge">DONE ✓</span></h1>
<div class="progress-bar-wrap"><div class="progress-bar-fill" id="pbar" style="width:0%"></div></div>
<div class="status-line" id="status">Loading…</div>

<h2>Pages</h2>
<div class="pages-grid" id="pages-grid"></div>

<h2>Polygon Extraction</h2>
<div id="poly-section"></div>

<div id="summary-section"></div>

<script>
let pollTimer = null;
let knownPages = 0;
let knownPolygons = 0;

function badge(cls, text){ return '<span class="badge badge-'+cls+'">'+text+'</span>'; }

function renderPages(pages){
  const sorted = [...pages].sort((a,b)=>a.pageNumber-b.pageNumber);
  const grid = document.getElementById('pages-grid');
  sorted.forEach(p => {
    const id = 'card-p'+p.pageNumber;
    if(document.getElementById(id)) return; // already rendered
    const imgRect = './page-'+p.pageNumber+'/page-'+p.pageNumber+'-rectangles.png';
    const imgFall = './page-'+p.pageNumber+'/page-'+p.pageNumber+'.png';
    const label = p.classification==='unit'
      ? (p.unitName && p.unitName!=='Unknown Unit' ? p.unitName : 'Unit (no name)')
      : (p.floorLabel||'Floor Plan');
    const warnBadge = p.warning ? badge('warn','!') : '';
    const warnText = p.warning ? '<br><span style="color:#fbbf24;font-size:.68rem">'+escHtml(p.warning)+'</span>' : '';
    const div = document.createElement('div');
    div.className='card'; div.id=id;
    div.innerHTML='<img src="'+imgRect+'" onerror="this.src=\\''+imgFall+'\\'"><div class="card-label" title="'+escHtml(label)+'">'+escHtml(label)+'</div>'+badge(p.classification,p.classification)+warnBadge+'<div class="card-meta">Page '+p.pageNumber+' · '+p.rectangleCount+' rect'+(p.rectangleCount!==1?'s':'')+warnText+'</div>';
    grid.appendChild(div);
  });
}

function renderPolygons(polygons){
  const sec = document.getElementById('poly-section');
  if(!polygons.length){ sec.innerHTML='<p class="na" style="font-size:.82rem;padding:6px 0">No polygon results yet.</p>'; return; }
  const rows = polygons.map(r=>{
    const sc = r.success?'ok':'fail';
    const st = r.success?'✓':'✗';
    const pts = r.success&&r.pointCount!=null?r.pointCount+' pts':'—';
    const reg = r.registeredToMaster!=null?(r.registeredToMaster?'<span class="ok">master</span>':'<span class="na">thumb</span>'):'<span class="na">—</span>';
    return '<tr><td>'+escHtml(r.floorKey)+'</td><td>'+escHtml(r.unitName)+'</td><td class="'+sc+'">'+st+'</td><td>'+pts+'</td><td>'+reg+'</td></tr>';
  }).join('');
  sec.innerHTML='<table class="poly-table"><thead><tr><th>Floor</th><th>Unit</th><th>OK?</th><th>Points</th><th>Coords</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

function renderSummary(summary){
  if(!summary) return;
  const sec = document.getElementById('summary-section');
  let html='<h2 style="margin-top:0">Final Summary</h2>';
  Object.entries(summary.floors).forEach(([fk,fd])=>{
    const units=Object.keys(fd.units);
    html+='<div class="sum-floor"><h3>'+escHtml(fd.floor)+' <span style="color:#64748b;font-weight:400">('+units.length+' unit'+(units.length!==1?'s':'')+')</span></h3><div class="sum-unit-list">'+(units.map(u=>'<span class="sum-unit">'+escHtml(u)+'</span>').join('')||'<span class="na">no units</span>')+'</div></div>';
  });
  sec.innerHTML=html;
}

function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function poll(){
  try{
    const res = await fetch('./progress-data.json?_='+Date.now());
    if(!res.ok) throw new Error('HTTP '+res.status);
    const d = await res.json();

    const pct = d.total>0?Math.round(d.processed/d.total*100):0;
    document.getElementById('pbar').style.width=pct+'%';
    document.getElementById('status').textContent=d.processed+' / '+d.total+' pages processed'+(d.done?' — complete':' — live');
    if(d.done){ document.getElementById('done-badge').style.display='inline'; document.title='PDF Pipeline — Done'; }
    else { document.title='PDF Pipeline — '+pct+'%'; }

    renderPages(d.pages||[]);
    renderPolygons(d.polygons||[]);
    if(d.done) renderSummary(d.summary);

    if(!d.done) pollTimer = setTimeout(poll, 2000);
  } catch(e){
    // data file not ready yet, retry
    pollTimer = setTimeout(poll, 1000);
  }
}

poll();
</script>
</body>
</html>`;
        try {
            fs.writeFileSync(path.join(this.outputRoot, 'progress.html'), html, 'utf-8');
        } catch {
            // non-fatal
        }
    }
}
