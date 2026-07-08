// Timer utility for performance measurement
export class PerformanceTimer {
    private timings: Map<string, number[]> = new Map();
    private startTimes: Map<string, number> = new Map();
    private totalStartTime: number = 0;

    startTotal(): void {
        this.totalStartTime = performance.now();
    }

    start(label: string): void {
        this.startTimes.set(label, performance.now());
    }

    end(label: string): number {
        const startTime = this.startTimes.get(label);
        if (startTime === undefined) {
            console.warn(`Timer: No start time found for "${label}"`);
            return 0;
        }
        const duration = performance.now() - startTime;
        this.startTimes.delete(label);
        
        if (!this.timings.has(label)) {
            this.timings.set(label, []);
        }
        this.timings.get(label)!.push(duration);
        return duration;
    }

    async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
        this.start(label);
        try {
            const result = await fn();
            this.end(label);
            return result;
        } catch (error) {
            this.end(label);
            throw error;
        }
    }

    timeSync<T>(label: string, fn: () => T): T {
        this.start(label);
        try {
            const result = fn();
            this.end(label);
            return result;
        } catch (error) {
            this.end(label);
            throw error;
        }
    }

    getTotalTime(): number {
        return performance.now() - this.totalStartTime;
    }

    getSummary(): string {
        const totalTime = this.getTotalTime();
        const lines: string[] = [];
        lines.push('\n' + '='.repeat(60));
        lines.push('PERFORMANCE TIMING SUMMARY');
        lines.push('='.repeat(60));
        
        // Sort by total time (sum of all calls)
        const sorted = Array.from(this.timings.entries())
            .map(([label, times]) => ({
                label,
                times,
                total: times.reduce((a, b) => a + b, 0),
                count: times.length,
                avg: times.reduce((a, b) => a + b, 0) / times.length,
                min: Math.min(...times),
                max: Math.max(...times)
            }))
            .sort((a, b) => b.total - a.total);

        lines.push(`\nTotal Execution Time: ${this.formatTime(totalTime)}`);
        lines.push(`\nFunction Timings:`);
        lines.push('-'.repeat(60));
        lines.push(
            `${'Function'.padEnd(35)} ${'Calls'.padStart(6)} ${'Total'.padStart(10)} ${'Avg'.padStart(10)} ${'Min'.padStart(10)} ${'Max'.padStart(10)}`
        );
        lines.push('-'.repeat(60));

        for (const { label, count, total, avg, min, max } of sorted) {
            const displayLabel = label.length > 34 ? label.substring(0, 31) + '...' : label;
            lines.push(
                `${displayLabel.padEnd(35)} ${String(count).padStart(6)} ${this.formatTime(total).padStart(10)} ${this.formatTime(avg).padStart(10)} ${this.formatTime(min).padStart(10)} ${this.formatTime(max).padStart(10)}`
            );
        }

        lines.push('-'.repeat(60));
        lines.push('='.repeat(60) + '\n');
        return lines.join('\n');
    }

    private formatTime(ms: number): string {
        if (ms < 1) {
            return `${ms.toFixed(2)}ms`;
        } else if (ms < 1000) {
            return `${ms.toFixed(1)}ms`;
        } else {
            return `${(ms / 1000).toFixed(2)}s`;
        }
    }
}
