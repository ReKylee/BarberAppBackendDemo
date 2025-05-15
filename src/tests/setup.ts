// src/tests/setup.ts
import { AppDataSource } from "../Infra/Database/DataSource";
import { QueryRunner } from "typeorm";
import { app } from "../server";
import request from "supertest";



// jest.setup.ts

// Extend the global namespace to add our custom properties
declare global {
  namespace NodeJS {
    interface Global {
      consoleOutput: {
        log: string[];
        error: string[];
        warn: string[];
        info: string[];
      };
      dumpConsoleOutput: () => void;
    }
  }
}

// Store the original console methods
const originalConsoleLog: typeof console.log = console.log;
const originalConsoleError: typeof console.error = console.error;
const originalConsoleWarn: typeof console.warn = console.warn;
const originalConsoleInfo: typeof console.info = console.info;

// Keep track of console output
(global as any).consoleOutput = { log: [], error: [], warn: [], info: [] };

// Override console methods to capture output
console.log = (...args: any[]): void => {
  (global as any).consoleOutput.log.push(args.join(' '));
  originalConsoleLog(...args);
};

console.error = (...args: any[]): void => {
  (global as any).consoleOutput.error.push(args.join(' '));
  originalConsoleError(...args);
};

console.warn = (...args: any[]): void => {
  (global as any).consoleOutput.warn.push(args.join(' '));
  originalConsoleWarn(...args);
};

console.info = (...args: any[]): void => {
  (global as any).consoleOutput.info.push(args.join(' '));
  originalConsoleInfo(...args);
};

// Add helper to dump console output
(global as any).dumpConsoleOutput = (): void => {
  console.log('--- Captured Console Output ---');
  
  if ((global as any).consoleOutput.log.length) {
    console.log('LOGS:', (global as any).consoleOutput.log.join('\n'));
  }
  
  if ((global as any).consoleOutput.error.length) {
    console.log('ERRORS:', (global as any).consoleOutput.error.join('\n'));
  }
  
  if ((global as any).consoleOutput.warn.length) {
    console.log('WARNINGS:', (global as any).consoleOutput.warn.join('\n'));
  }
  
  if ((global as any).consoleOutput.info.length) {
    console.log('INFO:', (global as any).consoleOutput.info.join('\n'));
  }
};

// Clear console output before each test
beforeEach((): void => {
  (global as any).consoleOutput = { log: [], error: [], warn: [], info: [] };
});

// Dump console output after each test
afterEach((): void => {
  if (process.env.DEBUG === 'true') {
    (global as any).dumpConsoleOutput();
  }
});


let queryRunner: QueryRunner;
export let agent: any; // Use any temporarily
let server: any;

beforeAll(async () => {
    try {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            await AppDataSource.synchronize(true);
        }

        // Create query runner for transactions
        queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        // Create a single server instance for all tests
        const PORT = 4000; // Use a different port than your dev server
        server = app.listen(PORT);
        agent = request.agent(app); // Create a reusable agent

        console.log("Test database and server connected");
    } catch (error) {
        console.error("Error setting up test environment:", error);
        throw error;
    }
});

afterAll(async () => {
    try {
        // Release query runner
        await queryRunner.release();

        // Close database connection
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }

        // Close the server
        if (server) {
            await new Promise<void>((resolve) => {
                server.close(() => {
                    console.log("Test server closed");
                    resolve();
                });
            });
        }

        console.log("Test environment cleaned up");
    } catch (error) {
        console.error("Error cleaning up test environment:", error);
    }
});

export {}
