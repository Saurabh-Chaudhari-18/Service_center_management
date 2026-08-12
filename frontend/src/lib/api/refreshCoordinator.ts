/** Share one token-refresh attempt across every request that received a 401. */
export class RefreshCoordinator<T> {
  private inFlight: Promise<T> | null = null;

  run(operation: () => Promise<T>): Promise<T> {
    if (!this.inFlight) {
      this.inFlight = operation().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }
}

export const tokenRefreshCoordinator = new RefreshCoordinator<string>();
