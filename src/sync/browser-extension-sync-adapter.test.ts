import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mockEventListener } from '../utils/test/mock-event-listener.js'
import { BrowserExtensionSyncAdapter } from './browser-extension-sync-adapter.js'
import type {
  SyncServiceConfig,
  BrowserExtensionCredentials,
  BrowserExtensionTarget,
  SyncMetadata,
  AuthStatus,
} from './types.js'

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

// Helper to create a mock config
const createMockConfig = (
  id = 'test-ext-sync',
  targetExtensionId = 'mock-extension-id'
): SyncServiceConfig<BrowserExtensionCredentials, BrowserExtensionTarget> => ({
  id,
  type: 'browserExtension',
  name: 'Test Extension Sync',
  credentials: { targetExtensionId },
  target: {},
  enabled: true,
  scope: 'all',
})

// Mock window.postMessage and event listeners
let mockPostMessage: ReturnType<typeof vi.fn>
let mockAddEventListener: ReturnType<typeof vi.fn>
let mockRemoveEventListener: ReturnType<typeof vi.fn>
let messageHandler: ((event: MessageEvent) => void) | undefined

// Helper to simulate a response from the extension
const simulateExtensionResponse = (
  requestId: string,
  payload?: any,
  error?: string
) => {
  if (messageHandler) {
    const event = new MessageEvent('message', {
      data: {
        source: 'utags-extension',
        requestId,

        payload,
        error,
      },
    }) as MessageEvent
    messageHandler(event)
  }
}

// Helper to capture sent messages
const getSentMessage = (callIndex = 0) => {
  return mockPostMessage.mock.calls[
    callIndex
  ][0] as BrowserExtensionMessage<any>
}

const getTimeoutErrorMessage = (messageType: string, timeoutMs: number) => {
  return `[BrowserExtensionSyncAdapter] Timeout waiting for response from extension mock-extension-id for request mock-uuid (type: ${messageType}, timeout: ${timeoutMs}ms)`
}

describe('BrowserExtensionSyncAdapter', () => {
  let adapter: BrowserExtensionSyncAdapter
  let mockConfig: SyncServiceConfig<
    BrowserExtensionCredentials,
    BrowserExtensionTarget
  >

  beforeEach(() => {
    // Reset mocks for each test
    mockPostMessage = vi.fn()
    messageHandler = undefined // Reset messageHandler

    const mockResult = mockEventListener((event, handler) => {
      if (event === 'message') {
        messageHandler = handler
      }
    })
    mockAddEventListener = mockResult.addEventListener
    mockRemoveEventListener = mockResult.removeEventListener

    vi.stubGlobal('crypto', { randomUUID: () => 'mock-uuid' })
    vi.stubGlobal('location', { origin: 'test-origin' })
    vi.stubGlobal('window', {
      postMessage: mockPostMessage,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      // setTimeout and clearTimeout are needed for request timeouts
      setTimeout: vi.fn((fn: () => void, delay: number) => {
        // Store the timer ID and allow manual triggering or actual timeout in tests
        const timerId = globalThis.setTimeout(fn, delay)
        return timerId as unknown as number
      }),
      clearTimeout: vi.fn((id: number) => {
        globalThis.clearTimeout(id)
      }),
      location: {
        origin: 'test-origin',
      },
    })

    adapter = new BrowserExtensionSyncAdapter()
    mockConfig = createMockConfig()
    vi.useFakeTimers() // Use fake timers for timeout tests
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('init', () => {
    it('should initialize successfully and send PING, receive PONG', async () => {
      const initPromise = adapter.init(mockConfig)
      // Simulate extension responding to PING
      // Need to wait for the message to be sent and handler to be registered
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      const sentMessage = getSentMessage()
      expect(sentMessage.type).toBe('PING')

      simulateExtensionResponse(sentMessage.requestId, { status: 'PONG' })
      await expect(initPromise).resolves.toBeUndefined()
      expect(adapter.getConfig().credentials?.targetExtensionId).toBe(
        'mock-extension-id'
      )
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )
    })

    it('should throw an error if PING fails or receives invalid PONG', async () => {
      const initPromise = adapter.init(mockConfig)
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      const sentMessage = getSentMessage()
      simulateExtensionResponse(sentMessage.requestId, { status: 'NOPE' }) // Invalid PONG
      await expect(initPromise).rejects.toThrow(
        '[BrowserExtensionSyncAdapter] Failed to establish initial connection with target extension mock-extension-id: Invalid PONG response or no response.'
      )
      expect(mockRemoveEventListener).toHaveBeenCalled()
    })

    it('should throw an error if PING times out', async () => {
      const initPromise = adapter.init(mockConfig)
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      vi.runAllTimers() // Trigger timeout
      await expect(initPromise).rejects.toThrow(
        getTimeoutErrorMessage('PING', 5000)
      )
      expect(mockRemoveEventListener).toHaveBeenCalled()
    })

    it('should throw if window is not available', async () => {
      vi.stubGlobal('window', undefined)
      adapter = new BrowserExtensionSyncAdapter() // Re-instantiate with no window
      await expect(adapter.init(mockConfig)).rejects.toThrow(
        'Cannot initialize adapter: Browser environment (window) not available.'
      )
    })
  })

  describe('getConfig', () => {
    it('should return the config after initialization', async () => {
      const initPromise = adapter.init(mockConfig)
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      simulateExtensionResponse(getSentMessage().requestId, { status: 'PONG' })
      await initPromise
      expect(adapter.getConfig()).toEqual(mockConfig)
    })

    it('should throw if called before initialization', () => {
      expect(() => adapter.getConfig()).toThrow(
        'Adapter not initialized or configuration not set. Call init() first.'
      )
    })
  })

  describe('upload', () => {
    const mockData = JSON.stringify({ foo: 'bar' })
    const mockRemoteMeta: SyncMetadata = { timestamp: 123, version: 'v1' }

    beforeEach(async () => {
      // Ensure adapter is initialized for these tests
      const initPromise = adapter.init(mockConfig)
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      simulateExtensionResponse(getSentMessage().requestId, { status: 'PONG' })
      await initPromise
      mockPostMessage.mockClear() // Clear PING call
    })

    it('should send UPLOAD_DATA message and resolve with metadata', async () => {
      const uploadPromise = adapter.upload(mockData, mockRemoteMeta)
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      const sentMessage = getSentMessage()
      expect(sentMessage.type).toBe('UPLOAD_DATA')
      expect(sentMessage.payload).toEqual({
        data: mockData,
        metadata: mockRemoteMeta,
      })

      const expectedResponseMeta: SyncMetadata = {
        timestamp: 456,
        version: 'v2',
      }
      simulateExtensionResponse(sentMessage.requestId, {
        metadata: expectedResponseMeta,
      })
      await expect(uploadPromise).resolves.toEqual(expectedResponseMeta)
    })

    it('should reject if extension returns an error', async () => {
      const uploadPromise = adapter.upload(mockData)
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      simulateExtensionResponse(
        getSentMessage().requestId,
        undefined,
        'Upload failed'
      )
      await expect(uploadPromise).rejects.toThrow('Upload failed')
    })

    it('should reject with a conflict error if remote metadata mismatch', async () => {
      const localMeta: SyncMetadata = { timestamp: 100, version: 'v0' } // Different from mockRemoteMeta in userscript
      const uploadPromise = adapter.upload(mockData, localMeta)

      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      const sentMessage = getSentMessage()
      expect(sentMessage.type).toBe('UPLOAD_DATA')
      expect(sentMessage.payload).toEqual({
        data: mockData,
        metadata: localMeta,
      })

      // Simulate the userscript throwing a conflict error
      // The userscript would compare sentMessage.payload.metadata with its internal mockRemoteMetadata
      // and throw if they don't match.
      const conflictErrorMessage =
        'Conflict: Expected remote metadata does not match current remote metadata.'
      simulateExtensionResponse(
        sentMessage.requestId,
        undefined,
        conflictErrorMessage
      )

      await expect(uploadPromise).rejects.toThrow(
        `[BrowserExtensionSyncAdapter] Error from extension mock-extension-id for request ${sentMessage.requestId}: ${conflictErrorMessage}`
      )
    })

    it('should reject on timeout', async () => {
      const uploadPromise = adapter.upload(mockData)
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      vi.runAllTimers()
      await expect(uploadPromise).rejects.toThrow(
        getTimeoutErrorMessage('UPLOAD_DATA', 30_000)
      )
    })

    it('should throw if called before initialization', async () => {
      const uninitializedAdapter = new BrowserExtensionSyncAdapter()
      await expect(uninitializedAdapter.upload(mockData)).rejects.toThrow(
        'Adapter not initialized.'
      )
    })
  })

  describe('download', () => {
    const mockDownloadedData = JSON.stringify({ baz: 'qux' })
    const mockRemoteMeta: SyncMetadata = { timestamp: 789, version: 'v3' }

    beforeEach(async () => {
      const initPromise = adapter.init(mockConfig)
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      simulateExtensionResponse(getSentMessage().requestId, { status: 'PONG' })
      await initPromise
      mockPostMessage.mockClear()
    })

    it('should send DOWNLOAD_DATA message and resolve with data and metadata', async () => {
      const downloadPromise = adapter.download()
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      const sentMessage = getSentMessage()
      expect(sentMessage.type).toBe('DOWNLOAD_DATA')
      expect(sentMessage.payload).toBeUndefined()

      simulateExtensionResponse(sentMessage.requestId, {
        data: mockDownloadedData,
        remoteMeta: mockRemoteMeta,
      })
      await expect(downloadPromise).resolves.toEqual({
        data: mockDownloadedData,
        remoteMeta: mockRemoteMeta,
      })
    })

    it('should reject if extension returns an error', async () => {
      const downloadPromise = adapter.download()
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      simulateExtensionResponse(
        getSentMessage().requestId,
        undefined,
        'Download failed'
      )
      await expect(downloadPromise).rejects.toThrow('Download failed')
    })

    it('should reject on timeout', async () => {
      const downloadPromise = adapter.download()
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      vi.runAllTimers()
      await expect(downloadPromise).rejects.toThrow(
        getTimeoutErrorMessage('DOWNLOAD_DATA', 30_000)
      )
    })

    it('should throw if called before initialization', async () => {
      const uninitializedAdapter = new BrowserExtensionSyncAdapter()
      await expect(uninitializedAdapter.download()).rejects.toThrow(
        'Adapter not initialized.'
      )
    })
  })

  describe('getRemoteMetadata', () => {
    const mockRemoteMeta: SyncMetadata = { timestamp: 101, version: 'v4' }

    beforeEach(async () => {
      const initPromise = adapter.init(mockConfig)
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      simulateExtensionResponse(getSentMessage().requestId, { status: 'PONG' })
      await initPromise
      mockPostMessage.mockClear()
    })

    it('should send GET_REMOTE_METADATA and resolve with metadata', async () => {
      const metadataPromise = adapter.getRemoteMetadata()
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      const sentMessage = getSentMessage()
      expect(sentMessage.type).toBe('GET_REMOTE_METADATA')

      simulateExtensionResponse(sentMessage.requestId, {
        metadata: mockRemoteMeta,
      })
      await expect(metadataPromise).resolves.toEqual(mockRemoteMeta)
    })

    it('should resolve with undefined if metadata not found', async () => {
      const metadataPromise = adapter.getRemoteMetadata()
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      simulateExtensionResponse(getSentMessage().requestId, {
        metadata: undefined,
      })
      await expect(metadataPromise).resolves.toBeUndefined()
    })

    it('should reject if extension returns an error', async () => {
      const metadataPromise = adapter.getRemoteMetadata()
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      simulateExtensionResponse(
        getSentMessage().requestId,
        undefined,
        'Metadata fetch failed'
      )
      await expect(metadataPromise).rejects.toThrow('Metadata fetch failed')
    })

    it('should reject on timeout', async () => {
      const metadataPromise = adapter.getRemoteMetadata()
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      vi.runAllTimers()
      await expect(metadataPromise).rejects.toThrow(
        getTimeoutErrorMessage('GET_REMOTE_METADATA', 30_000)
      )
    })

    it('should throw if called before initialization', async () => {
      const uninitializedAdapter = new BrowserExtensionSyncAdapter()
      await expect(uninitializedAdapter.getRemoteMetadata()).rejects.toThrow(
        'Adapter not initialized.'
      )
    })
  })

  describe('getAuthStatus', () => {
    beforeEach(async () => {
      const initPromise = adapter.init(mockConfig)
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      simulateExtensionResponse(getSentMessage().requestId, { status: 'PONG' })
      await initPromise
      mockPostMessage.mockClear()
    })

    it('should send GET_AUTH_STATUS and resolve with auth status', async () => {
      const authStatusPromise = adapter.getAuthStatus()
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      const sentMessage = getSentMessage()
      expect(sentMessage.type).toBe('GET_AUTH_STATUS')

      const expectedStatus: AuthStatus = 'authenticated'
      // The extension should send the AuthStatus string directly as payload
      simulateExtensionResponse(sentMessage.requestId, expectedStatus)
      await expect(authStatusPromise).resolves.toBe(expectedStatus)
    })

    it('should return "error" if extension returns an error', async () => {
      const authStatusPromise = adapter.getAuthStatus()
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      simulateExtensionResponse(
        getSentMessage().requestId,
        undefined,
        'Auth check failed'
      )
      await expect(authStatusPromise).resolves.toBe('error') // getAuthStatus handles errors by returning 'error'
    })

    it('should return "error" if response is not a valid AuthStatus', async () => {
      const authStatusPromise = adapter.getAuthStatus()
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      simulateExtensionResponse(
        getSentMessage().requestId,
        'invalid-status' as any
      )
      await expect(authStatusPromise).resolves.toBe('error')
    })

    it('should return "error" on timeout', async () => {
      const authStatusPromise = adapter.getAuthStatus()
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      vi.runAllTimers()
      await expect(authStatusPromise).resolves.toBe('error')
    })

    it('should return "unknown" if called before initialization', async () => {
      const uninitializedAdapter = new BrowserExtensionSyncAdapter()
      await expect(uninitializedAdapter.getAuthStatus()).resolves.toBe(
        'unknown'
      )
    })
  })

  describe('destroy', () => {
    it('should remove event listener and clear outstanding requests', async () => {
      // Initialize and make a request that will be outstanding
      const initPromise = adapter.init(mockConfig)
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      simulateExtensionResponse(getSentMessage().requestId, { status: 'PONG' })
      await initPromise
      mockPostMessage.mockClear()

      // Make a request but don't respond to it
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      adapter.getRemoteMetadata() // Don't await, let it be outstanding
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalled()
      })
      expect((adapter as any).outstandingRequests.size).toBe(1)

      adapter.destroy()

      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )
      expect((adapter as any).outstandingRequests.size).toBe(0)
      // Check if timers were cleared (hard to check directly without more complex timer mock)
      // But outstandingRequests.clear() implies associated timers are handled.
    })
  })
})
