import { mount } from '@vue/test-utils'; // Or shallowMount if preferred
import FileManagePage from '../FileManagePage.vue'; // Adjust path as needed
import { ref, nextTick } from 'vue';
import type { _Object } from '@aws-sdk/client-s3';

// Mock API calls
const mockListFiles = vi.fn();
const mockDeleteFile = vi.fn();
vi.mock('@/api', () => ({
    ListFiles: mockListFiles,
    DeleteFile: mockDeleteFile,
}));

// Mock js-cookie
const mockCookiesRemove = vi.fn();
vi.mock('js-cookie', () => ({
    default: { // Assuming Cookies is used as default export
        remove: mockCookiesRemove,
    },
}));

// Mock vue-router
const mockRouterPush = vi.fn();
vi.mock('vue-router', () => ({
    useRouter: () => ({
        push: mockRouterPush,
    }),
}));

// Mock @/utils/toast
const mockToast = vi.fn();
vi.mock('@/utils/toast', () => ({
    toast: mockToast,
}));

// Mock vue-i18n
const mockT = (key: string) => key; // Simple mock for t function
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: mockT,
    }),
}));

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

    const setupComponent = async (initialListFilesMock?: () => Promise<any>) => {
        if (initialListFilesMock) {
            mockListFiles.mockImplementationOnce(initialListFilesMock);
        } else {
            // Default successful response for most tests
            mockListFiles.mockResolvedValue({ Contents: mockFiles, IsTruncated: false, NextContinuationToken: undefined });
        }

        wrapper = mount(FileManagePage, {
            global: {
                // No longer need to mock $t here as useI18n is mocked globally
                stubs: {
                    // If there are child components that make network requests or are heavy, stub them
                    // e.g. 'ChildComponent': true
                }
            }
        });
        // Wait for onBeforeMount and initial refreshFiles/loadFilesChunk to complete
        await nextTick(); // For the ListFiles call within onBeforeMount
        await nextTick(); // For state updates from ListFiles
        await nextTick(); // Additional tick for safety with async operations
    };
    
    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();
        mockListFiles.mockReset();
        mockDeleteFile.mockReset();
        mockCookiesRemove.mockReset();
        mockRouterPush.mockReset();
        mockToast.mockReset();
    });

    // Helper to create Axios-like errors
    const createAxiosError = (status: number, message: string = 'Error') => {
        return {
            isAxiosError: true,
            response: {
                status: status,
            },
            message: message,
        };
    };

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

    describe('Error Handling', () => {
        describe('loadFilesChunk', () => {
            it('should handle 401 error by showing toast, removing cookie, and redirecting to login', async () => {
                const error401 = createAxiosError(401, 'Unauthorized');
                // Setup component without initial successful ListFiles call in onBeforeMount
                // We need to prevent the default onBeforeMount ListFiles from succeeding or simplify setup.
                // For this test, we let onBeforeMount call it, and it will be the one that fails.
                await setupComponent(() => Promise.reject(error401));
                
                // Assertions (onBeforeMount calls refreshFiles -> loadFilesChunk)
                expect(mockToast).toHaveBeenCalledWith(mockT("error.auth_failed_check_password"), 'error');
                expect(mockCookiesRemove).toHaveBeenCalledWith('PASSWORD');
                expect(mockRouterPush).toHaveBeenCalledWith('/login');
                expect(wrapper.vm.uploadedFiles).toEqual([]); // Ensure files list is empty
                expect(wrapper.vm.nextContinuationToken).toBeUndefined(); // Ensure token is cleared
            });

            it('should handle generic error by showing generic toast and not redirecting', async () => {
                const genericError = createAxiosError(500, 'Server Error');
                await setupComponent(() => Promise.reject(genericError));

                expect(mockToast).toHaveBeenCalledWith(mockT("error.generic_load_failed"), 'error');
                expect(mockCookiesRemove).not.toHaveBeenCalled();
                expect(mockRouterPush).not.toHaveBeenCalled();
                expect(wrapper.vm.uploadedFiles).toEqual([]);
                expect(wrapper.vm.nextContinuationToken).toBeUndefined();
            });
        });

        describe('onDeleteFileClick', () => {
            beforeEach(async () => {
                // Ensure component is set up with some files for deletion tests
                // and ListFiles mock for refreshFiles is successful by default after delete.
                await setupComponent(); 
                mockListFiles.mockResolvedValue({ Contents: [], IsTruncated: false, NextContinuationToken: undefined }); // For refreshFiles
            });

            it('should handle 401 error by showing toast, removing cookie, and redirecting to login', async () => {
                const error401 = createAxiosError(401, 'Unauthorized');
                mockDeleteFile.mockRejectedValueOnce(error401);

                await wrapper.vm.onDeleteFileClick('some-file-key');
                await nextTick(); // Allow async operations in catch block to complete

                expect(mockToast).toHaveBeenCalledWith(mockT("error.auth_failed_check_password"), 'error');
                expect(mockCookiesRemove).toHaveBeenCalledWith('PASSWORD');
                expect(mockRouterPush).toHaveBeenCalledWith('/login');
                // refreshFiles should not be called if DeleteFile fails with 401 before it
                expect(mockListFiles).toHaveBeenCalledTimes(1); // Once from setupComponent
            });

            it('should handle generic error by showing delete_failed toast and not redirecting', async () => {
                const genericError = createAxiosError(500, 'Server Error');
                mockDeleteFile.mockRejectedValueOnce(genericError);

                await wrapper.vm.onDeleteFileClick('some-file-key');
                await nextTick();

                expect(mockToast).toHaveBeenCalledWith(mockT("error.delete_failed"), 'error');
                expect(mockCookiesRemove).not.toHaveBeenCalled();
                expect(mockRouterPush).not.toHaveBeenCalled();
                 // refreshFiles should not be called if DeleteFile fails
                expect(mockListFiles).toHaveBeenCalledTimes(1); // Once from setupComponent
            });
        });
    });
});
