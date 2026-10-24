import { MutationCommand } from './CommandManager';

export class ASTCommand implements MutationCommand {
  public payload: string;
  public previousPayload?: string;
  public mergeKey?: string;
  private onExecuteCallback?: (nextCode: string) => void;
  private onUndoCallback?: (prevCode: string) => void;

  constructor(
    payload: string,
    previousPayload?: string,
    onExecuteCallback?: (nextCode: string) => void,
    onUndoCallback?: (prevCode: string) => void,
    mergeKey?: string
  ) {
    this.payload = payload;
    this.previousPayload = previousPayload;
    this.onExecuteCallback = onExecuteCallback;
    this.onUndoCallback = onUndoCallback;
    this.mergeKey = mergeKey;
  }

  public execute(): void {
    if (this.onExecuteCallback) {
      this.onExecuteCallback(this.payload);
    }
  }

  public undo(): void {
    if (this.onUndoCallback && this.previousPayload !== undefined) {
      this.onUndoCallback(this.previousPayload);
    }
  }
}
