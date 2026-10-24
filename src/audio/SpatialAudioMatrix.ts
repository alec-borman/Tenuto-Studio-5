export interface AudioBus {
  id: string;
  targets: string[];
}

export interface FXChainInstruction {
  type: string;
  parameters: Record<string, any>;
  length: number;
}

export type SendTapMode = 'pre' | 'post';

export interface SendRouteConfig {
  sourceBusId: string;
  targetBusId: string;
  level: number;
  mode: SendTapMode;
}

export class SpatialAudioMatrix {
  private buses: Map<string, AudioBus> = new Map();
  private sendRoutes: Map<string, SendRouteConfig> = new Map();

  public createBus(id: string): void {
    if (!id.startsWith('bus://')) {
      throw new Error(`Invalid bus URI schema: ${id}. Must prepend with bus://`);
    }
    if (!this.buses.has(id)) {
      this.buses.set(id, { id, targets: [] });
    }
  }

  public getBus(id: string): AudioBus | undefined {
    return this.buses.get(id);
  }

  public clear(): void {
    this.buses.clear();
    this.sendRoutes.clear();
  }

  public static toBusUri(trackOrBusId: string): string {
    return trackOrBusId.startsWith('bus://') ? trackOrBusId : `bus://${trackOrBusId}`;
  }

  public route(sourceId: string, targetId: string): void {
    const source = this.buses.get(sourceId);
    const target = this.buses.get(targetId);

    if (!source || !target) {
      throw new Error('Routing missing registered valid origin or target vertex.');
    }

    if (source.targets.includes(targetId)) {
      return;
    }

    // Speculative insertion to assess recursive cycles via Topo-DFS
    source.targets.push(targetId);

    if (this.detectCycle()) {
      // Revert if cycle breaks determinism
      source.targets.pop();
      throw new Error('E4001: Circular Routing Detected');
    }
  }

  /**
   * Registers or updates a send route from `sourceTrackId` to `returnBusId` with cycle detection,
   * level clamping (0..1), and `'pre' | 'post'` fader tap mode.
   */
  public registerTrackSend(
    sourceTrackId: string,
    returnBusId: string,
    level: number,
    mode: SendTapMode = 'post'
  ): SendRouteConfig {
    const sourceUri = SpatialAudioMatrix.toBusUri(sourceTrackId);
    const targetUri = SpatialAudioMatrix.toBusUri(returnBusId);

    this.createBus(sourceUri);
    this.createBus(targetUri);
    this.route(sourceUri, targetUri);

    const routeKey = `${sourceUri}->${targetUri}`;
    const existing = this.sendRoutes.get(routeKey);
    const config: SendRouteConfig = {
      sourceBusId: sourceUri,
      targetBusId: targetUri,
      level: Math.max(0, Math.min(1, Number(level))),
      mode: mode || existing?.mode || 'post',
    };
    this.sendRoutes.set(routeKey, config);
    return config;
  }

  public getTrackSends(sourceTrackId: string): SendRouteConfig[] {
    const sourceUri = SpatialAudioMatrix.toBusUri(sourceTrackId);
    const results: SendRouteConfig[] = [];
    for (const cfg of this.sendRoutes.values()) {
      if (cfg.sourceBusId === sourceUri) {
        results.push(cfg);
      }
    }
    return results;
  }

  /**
   * Computes the effective linear send gain for a track send route:
   * - In `'post'` mode, the send scales with the track's fader volume (`0..127`) and drops to `0` if the track is muted.
   * - In `'pre'` mode, the send bypasses the track's volume fader so the return bus hears the pre-fader signal even when fader is at 0.
   */
  public static computeEffectiveSendGain(
    sendLevel: number,
    mode: SendTapMode,
    trackVolumeMidi: number = 100,
    isTrackMuted: boolean = false
  ): number {
    if (isTrackMuted) return 0;
    const clampedSend = Math.max(0, Math.min(1, sendLevel));
    if (mode === 'pre') {
      return clampedSend;
    }
    const faderScalar = Math.max(0, Math.min(1.27, trackVolumeMidi / 100));
    return clampedSend * faderScalar;
  }

  private detectCycle(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = this.buses.get(nodeId);
      if (node) {
        for (const neighbor of node.targets) {
          if (!visited.has(neighbor) && dfs(neighbor)) {
            return true;
          } else if (recursionStack.has(neighbor)) {
            return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const busId of this.buses.keys()) {
      if (!visited.has(busId)) {
        if (dfs(busId)) {
          return true;
        }
      }
    }

    return false;
  }

  public parseFXChain(astString: string): FXChainInstruction {
    // Basic deterministic regex AST mapping for primitive execution limits: e.g. .fx(reverb, @{mix: 0.9, room: "hall"})
    const match = astString.match(/\.fx\(\s*(\w+)\s*,\s*@\{(.*?)\}\s*\)/);
    
    if (!match) {
        throw new Error(`Failed to parse valid fx structure from string: ${astString}`);
    }

    const type = match[1];
    const dictString = match[2];
    const parameters: Record<string, any> = {};

    // Break dictionary elements mapped mechanically mapped over comma splits
    const pairs = dictString.split(',').map(s => s.trim());

    pairs.forEach(pair => {
      const [keyRaw, valRaw] = pair.split(':').map(s => s.trim());
      
      let parsedValue: any = valRaw;
      if (valRaw.startsWith('"') && valRaw.endsWith('"')) {
        parsedValue = valRaw.slice(1, -1);
      } else if (!isNaN(Number(valRaw))) {
        parsedValue = Number(valRaw);
      }

      parameters[keyRaw] = parsedValue;
    });

    return {
      type,
      parameters,
      length: 1 
    };
  }
}
