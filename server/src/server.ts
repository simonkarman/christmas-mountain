import { Message, Server } from '@krmx/server';
import { joiner, leaver, ROOT_DISPATCHER, tick } from 'system';

// Configuration
export const PORT = 8082; // -- the port number at which the server will start
export const HISTORY_FILE_NAME: string | undefined = undefined; // './output/last-run.json'; // -- set to undefined if you want to disable auto safe/load functionality
export const BATCH_SIZE = 100; // -- the number of message to collect into one batch

// Custom Setup
export const setup = (server: Server, dispatchMessage: (dispatcher: string, message: Message) => void) => {
  server.on('join', (username) => {
    dispatchMessage(ROOT_DISPATCHER, joiner(username));
  });

  server.on('leave', (username) => {
    dispatchMessage(ROOT_DISPATCHER, leaver(username));
  });

  let tickCount = 0;
  setInterval(() => {
    if (server.getUsers().filter((u) => u.isLinked).length > 0) {
      tickCount += 1;
      dispatchMessage(ROOT_DISPATCHER, tick(tickCount));
    }
  }, 1000);
};
