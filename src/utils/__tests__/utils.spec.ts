import { formatDate } from '../utils'; // Adjust path as needed

describe('formatDate', () => {
    it('should return "N/A" for undefined input', () => {
        expect(formatDate(undefined)).toBe('N/A');
    });

    it('should format a valid date correctly', () => {
        const date = new Date(2023, 0, 15, 14, 30, 5); // Month is 0-indexed, so 0 is January
        // Expected: YYYY-MM-DD HH:mm:ss
        expect(formatDate(date)).toBe('2023-01-15 14:30:05');
    });

    it('should format a date with single digit month/day/hour/minute/second correctly (padding with zero)', () => {
        const date = new Date(2024, 2, 5, 8, 7, 3); // March 5th, 2024, 08:07:03
        expect(formatDate(date)).toBe('2024-03-05 08:07:03');
    });
    
    it('should format the epoch date correctly', () => {
        const date = new Date(0); // UTC: 1970-01-01 00:00:00
        // Note: The output depends on the local timezone of the test runner.
        // For consistency, we can construct a date that gives a known local time,
        // or mock the Date object's methods if timezone is an issue.
        // Let's assume the test runner is in a timezone where epoch is midnight.
        // A more robust test would be to check components:
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        expect(formatDate(date)).toBe(`${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
    });

     it('should handle another specific date correctly', () => {
        const date = new Date('2020-12-31T23:59:59Z'); // Use ISO string for timezone consistency (UTC)
        // Adjust expected output based on how Date constructor and formatDate handle timezones.
        // If formatDate inherently uses local time, this test will depend on the runner's timezone.
        // For this example, let's assume it correctly converts to local time and formats.
        const expectedYear = date.getFullYear();
        const expectedMonth = (date.getMonth() + 1).toString().padStart(2, '0');
        const expectedDay = date.getDate().toString().padStart(2, '0');
        const expectedHours = date.getHours().toString().padStart(2, '0');
        const expectedMinutes = date.getMinutes().toString().padStart(2, '0');
        const expectedSeconds = date.getSeconds().toString().padStart(2, '0');

        expect(formatDate(date)).toBe(`${expectedYear}-${expectedMonth}-${expectedDay} ${expectedHours}:${expectedMinutes}:${expectedSeconds}`);
    });
});
