// Browser-safe stub overriding native OS binaries for WebAssembly compatibility matrices
export const connect = async (..._args: any[]) => {
  return {
    openTable: async (..._tableArgs: any[]) => ({
      search: (..._searchArgs: any[]) => ({
        limit: (..._limitArgs: any[]) => ({
          execute: async () => [{ text: 'mock tenuto documentation (browser stub)' }]
        })
      })
    })
  };
};
