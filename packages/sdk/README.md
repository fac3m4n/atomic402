# SDK

SDK package for interacting with the server.

## Usage

```typescript
import { SDKClient } from "@repo/sdk";

const client = new SDKClient("http://localhost:3001");
const health = await client.health();
```

