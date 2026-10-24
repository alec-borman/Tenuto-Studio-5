export interface MutationCommand {
  mergeKey?: string;
  execute(): void;
  undo(): void;
}

export class CommandManager {
  private undoStack: MutationCommand[] = [];
  private redoStack: MutationCommand[] = [];

  public executeCommand(command: MutationCommand): void {
    command.execute();

    const top = this.undoStack[this.undoStack.length - 1];
    if (command.mergeKey && top && top.mergeKey === command.mergeKey) {
      const originalUndo = top.undo.bind(top);
      const latestExecute = command.execute.bind(command);
      this.undoStack[this.undoStack.length - 1] = {
        mergeKey: command.mergeKey,
        execute: latestExecute,
        undo: originalUndo,
      };
    } else {
      this.undoStack.push(command);
    }

    this.redoStack = [];
  }

  public undo(): void {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
    }
  }

  public redo(): void {
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
    }
  }

  public getUndoDepth(): number {
    return this.undoStack.length;
  }

  public getRedoDepth(): number {
    return this.redoStack.length;
  }
}
