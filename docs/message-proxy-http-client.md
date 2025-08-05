# Message Proxy HTTP Client

## Overview

The Message Proxy HTTP Client is a solution for bypassing CORS (Cross-Origin Resource Sharing) restrictions in web applications by using `window.postMessage` to communicate with userscripts or browser extensions that can make unrestricted HTTP requests.

## Architecture

```
┌─────────────────┐    postMessage    ┌──────────────────────┐    HTTP Request    ┌─────────────────┐
│   UTags WebApp  │ ◄──────────────► │ Userscript/Extension │ ◄──────────────► │  Remote Server  │
│                 │                   │                      │                    │                 │
│ MessageProxy    │                   │ GM.xmlHttpRequest/   │                    │ GitHub API,     │
│ HttpClient      │                   │ fetch API            │                    │ WebDAV, etc.    │
└─────────────────┘                   └──────────────────────┘                    └─────────────────┘
```

## Components

### 1. MessageProxyHttpClient

The main client class that handles communication with userscripts/extensions:

```typescript
import { MessageProxyHttpClient } from './sync/message-proxy-http-client.js'

const client = new MessageProxyHttpClient({
  timeout: 30000,
  targetOrigin: '*',
  source: 'utags-webapp',
})

// Make HTTP request
const response = await client.request({
  method: 'GET',
  url: 'https://api.github.com/user',
  headers: {
    Authorization: 'token YOUR_TOKEN',
  },
})
```

### 2. Updated HttpClient

The main `HttpClient` now automatically detects and uses the message proxy when available:

```typescript
import { HttpClient } from './sync/http-client.js'

// Automatically uses message proxy if available, falls back to direct requests
const response = await HttpClient.request({
  method: 'POST',
  url: 'https://api.example.com/data',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: 'example' }),
})
```

## Message Protocol

### Request Message

```typescript
type HttpRequestMessage = {
  type: 'HTTP_REQUEST'
  source: 'utags-webapp'
  id: string // Unique request ID
  payload: {
    method: string
    url: string
    headers?: Record<string, string>
    body?: string
    timeout?: number
  }
}
```

### Response Message

```typescript
type HttpResponseMessage = {
  type: 'HTTP_RESPONSE'
  source: 'utags-extension'
  id: string // Matching request ID
  payload: {
    ok: boolean
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
  }
}
```

### Error Message

```typescript
type HttpErrorMessage = {
  type: 'HTTP_ERROR'
  source: 'utags-extension'
  id: string // Matching request ID
  payload: {
    error: string
    details?: any
  }
}
```

## Userscript Implementation

### Installation

1. Install a userscript manager (Tampermonkey, Greasemonkey, etc.)
2. Install the UTags HTTP Proxy userscript from `userscript-example/utags-http-proxy.user.js`
3. The userscript will automatically handle HTTP requests from the UTags webapp

### Features

- Automatic CORS bypass using `GM.xmlHttpRequest`
- Request/response logging
- Error handling and timeout support
- Ping/pong availability detection

## Browser Extension Implementation

### Installation

1. Load the extension from `browser-extension-example/` directory
2. Enable developer mode in your browser
3. Load the unpacked extension
4. The extension will automatically handle HTTP requests from the UTags webapp

### Features

- Full CORS bypass using extension permissions
- Request statistics and monitoring
- Popup interface for status and control
- Background script for actual HTTP requests
- Content script for webapp communication

## Usage Examples

### GitHub API Integration

```typescript
// The GitHub sync adapter will automatically use message proxy if available
import { GitHubSyncAdapter } from './sync/git-hub-sync-adapter.js'

const adapter = new GitHubSyncAdapter()
await adapter.init({
  credentials: { token: 'your-github-token' },
  target: { repo: 'username/repo', path: 'bookmarks.json' },
})

// This will use message proxy for CORS bypass
const metadata = await adapter.getRemoteMetadata()
```

### WebDAV Integration

```typescript
// WebDAV client will also benefit from message proxy
import { WebDAVClient } from './sync/webdav-client.js'

const client = new WebDAVClient('https://webdav.example.com', {
  username: 'user',
  password: 'pass',
})

// CORS restrictions bypassed automatically
const stats = await client.stat('/bookmarks.json')
```

## Environment Detection

The system automatically detects the best available HTTP client:

1. **Message Proxy**: If userscript/extension is available
2. **Userscript Direct**: If running in userscript environment
3. **Browser Extension**: If running in extension context
4. **Standard Browser**: XMLHttpRequest or fetch (limited by CORS)

```typescript
import { EnvironmentDetector } from './sync/http-client.js'

// Check availability
const hasMessageProxy = await EnvironmentDetector.isMessageProxyAvailable()
const hasUserscript = EnvironmentDetector.isUserscriptEnvironment()
const hasExtension = EnvironmentDetector.isBrowserExtensionEnvironment()
```

## Error Handling

```typescript
try {
  const response = await HttpClient.request(options)
  // Handle successful response
} catch (error) {
  if (error.message.includes('timeout')) {
    // Handle timeout
  } else if (error.message.includes('CORS')) {
    // Handle CORS error (fallback scenario)
  } else {
    // Handle other errors
  }
}
```

## Configuration

### MessageProxyHttpClient Options

- `timeout`: Request timeout in milliseconds (default: 30000)
- `targetOrigin`: Target origin for postMessage (default: '\*')
- `source`: Source identifier for messages (default: 'utags-webapp')

### Userscript Configuration

- Modify `@match` directives to include your webapp domains
- Adjust timeout values in the userscript
- Enable/disable logging as needed

### Browser Extension Configuration

- Update `host_permissions` in manifest.json for required domains
- Modify `matches` in content_scripts for webapp domains
- Customize popup interface as needed

## Security Considerations

1. **Origin Validation**: Both userscript and extension validate message sources
2. **Request Filtering**: Consider implementing request URL filtering
3. **Token Security**: Never log or expose authentication tokens
4. **HTTPS Only**: Ensure all requests use HTTPS for sensitive data

## Troubleshooting

### Common Issues

1. **Message Proxy Not Available**
   - Ensure userscript/extension is installed and enabled
   - Check browser console for error messages
   - Verify domain matches in userscript/extension configuration

2. **Request Timeouts**
   - Increase timeout values in configuration
   - Check network connectivity
   - Verify target server is accessible

3. **CORS Errors in Fallback Mode**
   - Install and configure userscript or extension
   - Ensure proper permissions are granted
   - Check server CORS configuration

### Debug Mode

Enable debug logging by opening browser console and checking for:

- `[UTags Proxy]` messages from userscript
- `[UTags Extension]` messages from browser extension
- `MessageProxyHttpClient` messages from webapp

## Migration Guide

Existing code using the old HTTP client will automatically benefit from the new message proxy system without any changes required. The `HttpClient.request()` method maintains the same interface while adding CORS bypass capabilities.

## Performance Considerations

- Message proxy adds minimal overhead (~1-2ms per request)
- Userscript `GM.xmlHttpRequest` is typically faster than extension fetch
- Browser extension provides better error handling and monitoring
- Fallback to direct requests maintains compatibility
