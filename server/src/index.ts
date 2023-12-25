import { createServer, Message, Props } from '@krmx/server';
import { createHash } from 'crypto';
import * as fs from 'fs';
import { z } from 'zod';
import { system } from 'system';
import { BATCH_SIZE, HISTORY_FILE_NAME, PORT, setup } from './server';

// Implementation
const props: Props = { /* configure here */ };
const server = createServer(props);

type SysMessagePayload = {
  dispatcher: string,
  hash?: string,
} & Message;

interface SysMessage {
  type: 'sys',
  payload: SysMessagePayload,
}
interface BatchSysMessage {
  type: 'sys-batch',
  payload: SysMessagePayload[],
}

// Keep track of all dispatched messages (including username and timestamp)
const history: SysMessagePayload[] = [];

// On link send all previously dispatched messages first as a sys-batch message (per X message to avoid frame size limits of websockets)
server.on('link', (username) => {
  server.send(username, { type: 'sys-reset' });
  for (let i = 0; i < history.length; i += BATCH_SIZE) {
    const batchSysMessage: BatchSysMessage = {
      type: 'sys-batch',
      payload: history.slice(i, i + BATCH_SIZE),
    };
    server.send(username, batchSysMessage);
  }
});

// Keep track of a history of hashes of the state
const hashHistory: string[] = [];
system.onChange((state) => {
  if (history.length % BATCH_SIZE === 0) {
    hashHistory.push(createHash('sha256').update(JSON.stringify(state)).digest('hex'));
  }
});

// When dispatch a message, verify it against the system and broadcast on success
const dispatchMessage = (dispatcher: string, message: Message) => {
  if (system.dispatch(dispatcher, message) === true) {
    const payload: SysMessagePayload = {
      dispatcher,
      ...message,
      // Every X updates include a hash of the state to the client, to verify state equality
      hash: history.length % BATCH_SIZE === 0 ? hashHistory[hashHistory.length - 1] : undefined,
    };
    history.push(payload);

    if (server.getStatus() !== 'initializing') {
      const sysMessage: SysMessage = {
        type: 'sys',
        payload,
      };
      server.broadcast(sysMessage);
    }
  }
};

// Directly try and dispatch client messages
server.on('message', dispatchMessage);

// Add history file logic when a file name is provided
if (HISTORY_FILE_NAME) {
  const saveHistory = () => {
    fs.mkdirSync('./output', { recursive: true });
    fs.writeFileSync(HISTORY_FILE_NAME, JSON.stringify(history, undefined, 2));
  };
  const loadFromHistory = (): void => {
    if (history.length !== 0) {
      throw new Error('cannot load history if there is already history is already present');
    }
    if (!fs.existsSync(HISTORY_FILE_NAME)) {
      return;
    }
    const historySchema = z.array(z.object({ hash: z.string().optional(), dispatcher: z.string(), type: z.string(), payload: z.any() }));
    const fileHistoryParsed = historySchema.safeParse(JSON.parse(fs.readFileSync(HISTORY_FILE_NAME).toString()));
    if (fileHistoryParsed.success) {
      fileHistoryParsed.data.forEach(historyEntry => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = { ...historyEntry };
        delete payload.dispatcher;
        delete payload.hash;
        dispatchMessage(historyEntry.dispatcher, payload);
      });
    }
  };
  // On an interval, save to the history file
  setInterval(saveHistory, 1000);
  // Replay all history from file system before starting the server
  loadFromHistory();
}

// Do server specific functionality
setup(server, dispatchMessage);

// Start the server
server.listen(PORT);
