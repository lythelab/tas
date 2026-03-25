import { Tool } from "../types";

export class ToolExecutor {
  private readonly tools = new Map<string, Tool>();

  constructor(tools: Tool[]) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async execute(name: string, argText: string): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    let parsed: Record<string, unknown> = {};
    if (argText && argText.trim().length > 0) {
      try {
        parsed = JSON.parse(argText) as Record<string, unknown>;
      } catch {
        throw new Error(`Invalid JSON arguments for tool ${name}`);
      }
    }

    return tool.execute(parsed);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }
}
