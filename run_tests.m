function results = run_tests()
%RUN_TESTS Run the ImageLab unit tests and print a summary table.
%   Runs once with the Image Processing Toolbox (if installed) and once with
%   the toolbox disabled, so both code paths are verified.

root = ilab_setup();
suite = matlab.unittest.TestSuite.fromFile(fullfile(root, 'tests', 'ImageLabTests.m'));

if hasIPT(), mode = 'Image Processing Toolbox'; else, mode = 'manual (toolbox not installed)'; end
fprintf('\n=== Run 1: %s code path ===\n', mode);
results = run(suite);
disp(table(results));

if hasIPT()
    setenv('ILAB_FORCE_MANUAL', '1');
    cleanup = onCleanup(@() setenv('ILAB_FORCE_MANUAL', ''));
    fprintf('\n=== Run 2: manual fallback path ===\n');
    results = [results, run(suite)];
end

fprintf('\n%d passed, %d failed, %d incomplete\n', ...
    nnz([results.Passed]), nnz([results.Failed]), nnz([results.Incomplete]));
end
