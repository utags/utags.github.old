import type {
  AuthStatus,
  BrowserExtensionCredentials,
  BrowserExtensionTarget,
  SyncAdapter,
  SyncMetadata,
  SyncServiceConfig,
} from './types.js'

// Message types for communication with the extension
type BrowserExtensionMessage<T> = {
  type: string
  payload?: T
  source: 'utags-webapp'
  requestId: string
}

type BrowserExtensionResponse<R> = {
  type: string
  payload?: R
  error?: string
  source: 'utags-extension'
  requestId: string
}

/**
 * Adapter for synchronizing data with another browser extension.
 * Communicates via browser extension messaging (content script bridge using window.postMessage).
 */
export class BrowserExtensionSyncAdapter
  implements SyncAdapter<BrowserExtensionCredentials, BrowserExtensionTarget>
{
  private config!: SyncServiceConfig<
    BrowserExtensionCredentials,
    BrowserExtensionTarget
  >

  private targetExtensionId = 'TARGET_EXTENSION_ID_NOT_SET' // Default, should be set in init
  private initialized = false
  private readonly outstandingRequests = new Map<
    string,
    {
      resolve: (value: any) => void
      reject: (reason?: any) => void
      timer: number
    }
  >()

  constructor() {
    // Configuration will be provided via the init method
    this.handleExtensionMessage = this.handleExtensionMessage.bind(this)
  }

  /**
   * Initializes the adapter with a specific configuration.
   * @param config - The configuration for this sync service instance.
   */
  async init(
    config: SyncServiceConfig<
      BrowserExtensionCredentials,
      BrowserExtensionTarget
    >
  ): Promise<void> {
    if (this.initialized) {
      return
    }

    // eslint-disable-next-line unicorn/prefer-global-this
    if (typeof window === 'undefined') {
      // No change needed here, this is a guard for non-browser environments.
      throw new TypeError(
        'Cannot initialize adapter: Browser environment (window) not available.'
      )
    }

    this.config = config
    this.targetExtensionId =
      config.credentials?.targetExtensionId || 'TARGET_EXTENSION_ID_NOT_SET' // Keep this for context

    window.addEventListener('message', this.handleExtensionMessage)

    try {
      const response = await this.sendMessageToExtension<
        undefined,
        { status: string } // Expected response for PING
      >(
        {
          type: 'PING',
        },
        5000 // Shorter timeout for initial PING
      )
      if (response && response.status === 'PONG') {
        this.initialized = true
        console.info(
          `[BrowserExtensionSyncAdapter] Successfully connected to target extension ${this.targetExtensionId}.`
        )
      } else {
        // If PONG is not received or response is malformed
        throw new Error(
          `[BrowserExtensionSyncAdapter] Failed to establish initial connection with target extension ${this.targetExtensionId}: Invalid PONG response or no response.`
        )
      }
    } catch (error: any) {
      window.removeEventListener('message', this.handleExtensionMessage) // Ensure cleanup on any error during init
      console.error(
        `[BrowserExtensionSyncAdapter] Failed to initialize connection with target extension ${this.targetExtensionId}:`,
        error
      )

      if (
        (error.message as string)?.startsWith('[BrowserExtensionSyncAdapter]')
      ) {
        throw error as Error
      }

      // Re-throw a more specific error to be caught by SyncManager or caller
      throw new Error(
        `[BrowserExtensionSyncAdapter] Failed to initialize connection with target extension ${this.targetExtensionId}: ${error.message}`
      )
    }
  }

  /**
   * Cleans up resources used by the adapter.
   */
  destroy(): void {
    // eslint-disable-next-line unicorn/prefer-global-this
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.handleExtensionMessage)
    }

    for (const [key, req] of this.outstandingRequests) {
      clearTimeout(req.timer)
    }

    this.outstandingRequests.clear()
    this.initialized = false
    console.info('[BrowserExtensionSyncAdapter] Destroyed.')
  }

  /**
   * Gets the current configuration of the adapter.
   * @returns The current configuration of the adapter.
   */
  getConfig(): SyncServiceConfig<
    BrowserExtensionCredentials,
    BrowserExtensionTarget
  > {
    if (!this.initialized || !this.config) {
      throw new Error(
        'Adapter not initialized or configuration not set. Call init() first.'
      )
    }

    return this.config
  }

  /**
   * Retrieves metadata of the remote file/data.
   * @returns A promise that resolves with the remote metadata, or undefined if not found.
   */
  async getRemoteMetadata(): Promise<SyncMetadata | undefined> {
    if (!this.initialized) throw new Error('Adapter not initialized.')
    const response = await this.sendMessageToExtension<
      undefined, // No payload for GET_REMOTE_METADATA
      { metadata: SyncMetadata | undefined } // Expected response type
    >({
      type: 'GET_REMOTE_METADATA',
    })
    return response.metadata
  }

  /**
   * Downloads data from the remote service.
   * @returns A promise that resolves with an object containing the downloaded data (string) and its remote metadata.
   */
  async download(): Promise<{
    data: string | undefined
    remoteMeta: SyncMetadata | undefined
  }> {
    if (!this.initialized) throw new Error('Adapter not initialized.')
    // The SyncAdapter interface for download doesn't take metadata as an argument.
    // If the extension needs it (e.g. for incremental download), it should be handled internally by the extension
    // or the PING/initial handshake could exchange initial metadata.
    const response = await this.sendMessageToExtension<
      undefined, // No payload for DOWNLOAD_DATA
      { data: string | undefined; remoteMeta: SyncMetadata | undefined } // Expected response type
    >({
      type: 'DOWNLOAD_DATA',
    })
    return response // This matches the SyncAdapter return type
  }

  /**
   * Uploads data to the remote service.
   * @param data - The stringified bookmark data to upload.
   * @param expectedRemoteMeta - Optional metadata of the remote file for optimistic locking.
   * @returns A promise that resolves with the metadata of the uploaded/updated remote file.
   */
  async upload(
    data: string, // Data is now a string as per SyncAdapter interface
    expectedRemoteMeta?: SyncMetadata
  ): Promise<SyncMetadata> {
    if (!this.initialized) throw new Error('Adapter not initialized.')
    const response = await this.sendMessageToExtension<
      { data: string; metadata?: SyncMetadata }, // Payload type for UPLOAD_DATA
      { metadata: SyncMetadata } // Expected response type
    >({
      type: 'UPLOAD_DATA',
      payload: { data, metadata: expectedRemoteMeta },
    })
    return response.metadata
  }

  /**
   * Checks the authentication status with the remote service.
   * @returns A promise that resolves with the authentication status.
   */
  async getAuthStatus(): Promise<AuthStatus> {
    if (!this.initialized) {
      console.warn(
        '[BrowserExtensionSyncAdapter] getAuthStatus called before successful initialization.'
      )
      return 'unknown'
    }

    try {
      // The mock script directly returns an AuthStatus string as payload for GET_AUTH_STATUS.
      // So, the expected response type R for sendMessageToExtension should be AuthStatus itself.
      const authStatusResponse = await this.sendMessageToExtension<
        undefined,
        AuthStatus // Expecting AuthStatus directly from the payload
      >(
        {
          type: 'GET_AUTH_STATUS',
        },
        10_000 // Timeout for auth status check
      )

      const validStatuses: AuthStatus[] = [
        'authenticated',
        'unauthenticated',
        'error',
        'requires_config',
        'unknown',
      ]

      if (
        typeof authStatusResponse === 'string' &&
        validStatuses.includes(authStatusResponse)
      ) {
        return authStatusResponse
      }

      console.warn(
        `[BrowserExtensionSyncAdapter] Invalid auth status received from ${this.targetExtensionId}:`,
        authStatusResponse
      )
      return 'error' // Treat unexpected or invalid response as an error status
    } catch (error: any) {
      console.error(
        `[BrowserExtensionSyncAdapter] Error getting auth status from ${this.targetExtensionId}:`,
        error
      )
      return 'error' // Network errors or timeouts result in 'error' status
    }
  }

  /**
   * Sends a message to the target browser extension via window.postMessage.
   * @param messageData - Object containing the type and payload of the message.
   * @returns A promise that resolves with the response from the extension.
   */
  private async sendMessageToExtension<T, R>(
    messageData: {
      type: string
      payload?: T
    },
    timeoutMs = 30_000 // Default timeout, can be overridden
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line unicorn/prefer-global-this
      if (typeof window === 'undefined') {
        reject(
          new Error(
            '[BrowserExtensionSyncAdapter] Browser environment (window) not available.'
          )
        )
        return
      }

      const requestId = crypto.randomUUID()
      const message: BrowserExtensionMessage<T> = {
        ...messageData,
        source: 'utags-webapp',
        requestId,
      }

      const timer = globalThis.setTimeout(() => {
        this.outstandingRequests.delete(requestId)
        reject(
          new Error(
            `[BrowserExtensionSyncAdapter] Timeout waiting for response from extension ${this.targetExtensionId} for request ${requestId} (type: ${message.type}, timeout: ${timeoutMs}ms)`
          )
        )
      }, timeoutMs) as unknown as number

      this.outstandingRequests.set(requestId, { resolve, reject, timer })

      try {
        // It's good practice to ensure targetOrigin is as specific as possible if known,
        // but '*' is common for userscripts/extensions if the origin isn't fixed.
        // For this adapter, '*' is acceptable as the target is another local extension/script.
        window.postMessage(message, '*')
        console.debug(
          `[BrowserExtensionSyncAdapter] Sent message to extension ${this.targetExtensionId}:`,
          message
        )
      } catch (error: any) {
        // Catch potential errors from postMessage itself (though rare for '*' target)
        clearTimeout(timer)
        this.outstandingRequests.delete(requestId)
        console.error(
          `[BrowserExtensionSyncAdapter] Error sending message to extension ${this.targetExtensionId}:`,
          error
        )
        reject(
          new Error(
            `[BrowserExtensionSyncAdapter] Failed to send message to extension ${this.targetExtensionId}: ${error.message}`
          )
        )
      }
    })
  }

  /**
   * Handles messages received from the extension.
   * @param event - The MessageEvent from window.onmessage.
   */
  private handleExtensionMessage(event: MessageEvent): void {
    // Basic validation of the event origin and data structure
    // Note: event.origin check might be too restrictive if the webapp and userscript are on different subdomains/ports during development.
    // However, for security, it's good. The userscript already has its own origin check.
    if (
      event.origin !== globalThis.location.origin &&
      !this.config.credentials?.targetExtensionId
    ) {
      // If targetExtensionId is not set, we might be more strict with origin.
      // If targetExtensionId is set, the source check below becomes more important.
      // console.warn(`[BrowserExtensionSyncAdapter] Ignoring message from unexpected origin: ${event.origin}`);
      // return;
    }

    const response = event.data as BrowserExtensionResponse<any>

    if (
      response &&
      response.source === 'utags-extension' && // Crucial check for source
      response.requestId
    ) {
      console.debug(
        `[BrowserExtensionSyncAdapter] Received message from extension ${this.targetExtensionId}:`,
        response
      )
      const requestCallbacks = this.outstandingRequests.get(response.requestId)
      if (requestCallbacks) {
        clearTimeout(requestCallbacks.timer)
        if (response.error) {
          // The error from the extension (e.g., userscript) is propagated.
          // This could be a string or an object with a message property.
          // Creating a new Error ensures a proper error object is rejected.
          const errorMessage =
            typeof response.error === 'string'
              ? response.error
              : JSON.stringify(response.error)
          requestCallbacks.reject(
            new Error(
              `[BrowserExtensionSyncAdapter] Error from extension ${this.targetExtensionId} for request ${response.requestId}: ${errorMessage}`
            )
          )
        } else {
          requestCallbacks.resolve(response.payload)
        }

        this.outstandingRequests.delete(response.requestId)
      } else {
        console.warn(
          `[BrowserExtensionSyncAdapter] Received response for unknown or timed out request ID: ${response.requestId}`,
          response
        )
      }
    } // Other messages are ignored (e.g., not from 'utags-extension' or no requestId)
  }
}
