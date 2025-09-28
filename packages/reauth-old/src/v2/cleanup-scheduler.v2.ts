import type { CleanupScheduler, CleanupTask, OrmLike } from './types.v2';

/**
 * Simple in-memory cleanup scheduler for background tasks.
 * Runs registered cleanup tasks at their specified intervals.
 */
export class SimpleCleanupScheduler implements CleanupScheduler {
  private tasks: CleanupTask[] = [];
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private running = false;
  private getOrm: () => Promise<OrmLike>;
  private pluginConfigs: Map<string, any> = new Map();

  constructor(getOrm: () => Promise<OrmLike>) {
    this.getOrm = getOrm;
  }

  registerTask(task: CleanupTask): void {
    // Replace existing task with same name/plugin
    const existingIndex = this.tasks.findIndex(
      t => t.name === task.name && t.pluginName === task.pluginName
    );
    
    if (existingIndex >= 0) {
      // Stop existing interval if running
      const existingTask = this.tasks[existingIndex];
      if (existingTask) {
        const intervalKey = `${existingTask.pluginName}:${existingTask.name}`;
        const existingInterval = this.intervals.get(intervalKey);
        if (existingInterval) {
          clearInterval(existingInterval);
          this.intervals.delete(intervalKey);
        }
      }
      
      this.tasks[existingIndex] = task;
    } else {
      this.tasks.push(task);
    }

    // Start interval if scheduler is running and task is enabled
    if (this.running && task.enabled) {
      this.startTaskInterval(task);
    }
  }

  setPluginConfig(pluginName: string, config: any): void {
    this.pluginConfigs.set(pluginName, config);
  }

  async start(): Promise<void> {
    if (this.running) return;
    
    this.running = true;
    
    // Start intervals for all enabled tasks
    for (const task of this.tasks) {
      if (task.enabled) {
        this.startTaskInterval(task);
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    
    this.running = false;
    
    // Clear all intervals
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  isRunning(): boolean {
    return this.running;
  }

  getRegisteredTasks(): CleanupTask[] {
    return [...this.tasks];
  }

  private startTaskInterval(task: CleanupTask): void {
    const intervalKey = `${task.pluginName}:${task.name}`;
    
    // Clear existing interval if any
    const existingInterval = this.intervals.get(intervalKey);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Create new interval
    const interval = setInterval(async () => {
      try {
        const orm = await this.getOrm();
        const config = this.pluginConfigs.get(task.pluginName);
        const result = await task.runner(orm, config);
        
        // Log success (in production, use proper logging)
        if (result.cleaned > 0) {
          console.log(`[ReAuth Cleanup] ${task.pluginName}.${task.name}: cleaned ${result.cleaned} items`);
        }
        
        if (result.errors && result.errors.length > 0) {
          console.warn(`[ReAuth Cleanup] ${task.pluginName}.${task.name}: ${result.errors.length} errors occurred`);
        }
      } catch (error) {
        // Never let cleanup errors break the scheduler
        console.error(`[ReAuth Cleanup] ${task.pluginName}.${task.name} failed:`, error);
      }
    }, task.intervalMs);

    this.intervals.set(intervalKey, interval);
  }
}