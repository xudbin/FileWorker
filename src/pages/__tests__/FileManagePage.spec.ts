import { mount } from '@vue/test-utils'; // Or shallowMount if preferred
import FileManagePage from '../FileManagePage.vue'; // Adjust path as needed
import { ref, nextTick } from 'vue';
import type { _Object } from '@aws-sdk/client-s3';

// Mock API calls
vi.mock('@/api', () => ({
    ListFiles: vi.fn(),
    DeleteFile: vi.fn(),
}));

// Mock i18n
const mockT = (key: string) => key;

const createMockFile = (key: string, lastModified: Date, size?: number): _Object => ({
    Key: key,
    LastModified: lastModified,
    Size: size || 1024, // Default size
    ETag: `"${key}-etag"`,
    Owner: { ID: 'owner-id', DisplayName: 'Owner Name' },
    StorageClass: 'STANDARD',
});

describe('FileManagePage.vue', () => {
    let wrapper: any;

    const mockFiles: _Object[] = [
        createMockFile("apple.txt", new Date("2023-01-10T10:00:00Z")),
        createMockFile("Banana.txt", new Date("2023-01-15T12:00:00Z")), // Note: Capital B for name sorting
        createMockFile("cherry.txt", new Date("2023-01-05T08:00:00Z")),
    ];

    const setupComponent = async (files: _Object[] | null = mockFiles) => {
        const { ListFiles } = await import('@/api');
        (ListFiles as vi.Mock).mockResolvedValue({ Contents: files, IsTruncated: false, NextContinuationToken: undefined });

        wrapper = mount(FileManagePage, {
            global: {
                mocks: {
                    $t: mockT,
                },
                stubs: {
                    // If there are child components that make network requests or are heavy, stub them
                    // e.g. 'ChildComponent': true
                }
            }
        });
        // Wait for onBeforeMount and initial refreshFiles to complete
        await nextTick(); // For ListFiles call
        await nextTick(); // For state updates from ListFiles
    };

    beforeEach(async () => {
        // Reset mocks before each test if they are modified
        vi.clearAllMocks();
    });

    it('should sort files by name ascending by default', async () => {
        await setupComponent();
        const sorted = wrapper.vm.sortedFiles;
        expect(sorted[0].Key).toBe('apple.txt');
        expect(sorted[1].Key).toBe('Banana.txt'); // Note: Case sensitivity of default sort if not handled by decodeKey+toLowerCase
        expect(sorted[2].Key).toBe('cherry.txt');
    });

    it('should sort files by name descending', async () => {
        await setupComponent();
        await wrapper.vm.setSort('name'); // First click sets to name (asc), second to name (desc)
        await wrapper.vm.setSort('name'); 
        await nextTick();
        
        const sorted = wrapper.vm.sortedFiles;
        expect(sorted[0].Key).toBe('cherry.txt');
        expect(sorted[1].Key).toBe('Banana.txt');
        expect(sorted[2].Key).toBe('apple.txt');
    });

    it('should sort files by date ascending', async () => {
        await setupComponent();
        await wrapper.vm.setSort('lastModified');
        await nextTick();

        const sorted = wrapper.vm.sortedFiles;
        expect(sorted[0].Key).toBe('cherry.txt'); // Jan 5
        expect(sorted[1].Key).toBe('apple.txt');  // Jan 10
        expect(sorted[2].Key).toBe('Banana.txt'); // Jan 15
    });

    it('should sort files by date descending', async () => {
        await setupComponent();
        await wrapper.vm.setSort('lastModified'); // asc
        await wrapper.vm.setSort('lastModified'); // desc
        await nextTick();

        const sorted = wrapper.vm.sortedFiles;
        expect(sorted[0].Key).toBe('Banana.txt'); // Jan 15
        expect(sorted[1].Key).toBe('apple.txt');  // Jan 10
        expect(sorted[2].Key).toBe('cherry.txt'); // Jan 5
    });

    it('should handle an empty list of files', async () => {
        await setupComponent([]);
        expect(wrapper.vm.sortedFiles).toEqual([]);
    });

    it('should handle files with missing Key (treated as empty string for sort)', async () => {
        const filesWithMissingKey: _Object[] = [
            createMockFile("b.txt", new Date("2023-01-10T10:00:00Z")),
            { ...createMockFile("", new Date("2023-01-15T12:00:00Z")), Key: undefined }, // Missing Key
            createMockFile("a.txt", new Date("2023-01-05T08:00:00Z")),
        ];
        await setupComponent(filesWithMissingKey);
        // Default sort: name ascending. "" should come first.
        let sorted = wrapper.vm.sortedFiles;
        expect(sorted[0].Key).toBeUndefined();
        expect(sorted[1].Key).toBe('a.txt');
        expect(sorted[2].Key).toBe('b.txt');

        // Sort by name descending
        await wrapper.vm.setSort('name');
        await wrapper.vm.setSort('name');
        await nextTick();
        sorted = wrapper.vm.sortedFiles;
        expect(sorted[0].Key).toBe('b.txt');
        expect(sorted[1].Key).toBe('a.txt');
        expect(sorted[2].Key).toBeUndefined();
    });
    
    it('should handle files with missing LastModified (treated as epoch/0 for sort)', async () => {
        const filesWithMissingDate: _Object[] = [
            createMockFile("b.txt", new Date("2023-01-10T10:00:00Z")),
            { ...createMockFile("c.txt", new Date(0)), LastModified: undefined }, // Missing LastModified
            createMockFile("a.txt", new Date("2023-01-05T08:00:00Z")),
        ];
        await setupComponent(filesWithMissingDate);
        await wrapper.vm.setSort('lastModified'); // Sort by date ascending
        await nextTick();
        
        const sorted = wrapper.vm.sortedFiles;
        // Undefined date is treated as 0 (epoch), so it comes first in ascending sort
        expect(sorted[0].Key).toBe('c.txt'); 
        expect(sorted[1].Key).toBe('a.txt');
        expect(sorted[2].Key).toBe('b.txt');

        // Sort by date descending
        await wrapper.vm.setSort('lastModified');
        await nextTick();
        const sortedDesc = wrapper.vm.sortedFiles;
        expect(sortedDesc[0].Key).toBe('b.txt');
        expect(sortedDesc[1].Key).toBe('a.txt');
        expect(sortedDesc[2].Key).toBe('c.txt');
    });

    it('setSort should toggle order if key is the same, and switch to asc if key is different', async () => {
        await setupComponent();
        
        // Initial: name, asc
        expect(wrapper.vm.sortKey).toBe('name');
        expect(wrapper.vm.sortOrder).toBe('asc');

        // Click name sort: name, desc
        await wrapper.vm.setSort('name');
        expect(wrapper.vm.sortKey).toBe('name');
        expect(wrapper.vm.sortOrder).toBe('desc');

        // Click name sort: name, asc
        await wrapper.vm.setSort('name');
        expect(wrapper.vm.sortKey).toBe('name');
        expect(wrapper.vm.sortOrder).toBe('asc');

        // Click date sort: lastModified, asc
        await wrapper.vm.setSort('lastModified');
        expect(wrapper.vm.sortKey).toBe('lastModified');
        expect(wrapper.vm.sortOrder).toBe('asc');

        // Click date sort: lastModified, desc
        await wrapper.vm.setSort('lastModified');
        expect(wrapper.vm.sortKey).toBe('lastModified');
        expect(wrapper.vm.sortOrder).toBe('desc');
    });
});
