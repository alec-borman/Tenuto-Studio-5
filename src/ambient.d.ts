declare module '@lancedb/lancedb' {
  export function connect(uri: string): Promise<{
    openTable(name: string): Promise<{
      search(query: string): {
        limit(n: number): {
          execute(): Promise<Array<{ text: string }>>;
        };
      };
    }>;
  }>;
}
