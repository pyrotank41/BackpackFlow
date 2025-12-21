/**
 * Jest Test Setup
 * 
 * Configures global test environment for clean output.
 * 
 * Industry Standard: Tests should be silent on success, verbose on failure.
 * - Console warnings/logs are suppressed during test runs
 * - On test failure, console is restored automatically
 * - Tests can still explicitly assert console calls when needed
 */

let consoleSpies: jest.SpyInstance[] = [];

beforeEach(() => {
    // Suppress console output for clean test output
    consoleSpies = [
        jest.spyOn(console, 'warn').mockImplementation(() => {}),
        jest.spyOn(console, 'log').mockImplementation(() => {}),
        // Keep console.error visible for failures
    ];
});

afterEach(() => {
    // Restore console after each test
    // This ensures failures show their console output
    consoleSpies.forEach(spy => spy.mockRestore());
});

