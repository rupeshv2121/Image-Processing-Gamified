function S = histeqSteps(A, L)
%HISTEQSTEPS Histogram equalisation of a small integer matrix, step by step.
%   S = histeqSteps(A, L) for grey levels 0..L-1 (default L = 8, a 3-bit image).
%
%     n_r  = number of pixels with level r              (counting)
%     p_r  = n_r / N                                    (normalising)
%     cdf  = p_0 + ... + p_r                            (cumulative sum)
%     s_r  = round((L - 1) * cdf_r)                     (mapping)
%     g    = s(f + 1)                                   (look-up table)
%
%   S.counts, S.p, S.cdf, S.mapping are 1-by-L; S.output is the equalised matrix.
%   The same algorithm as histogramEqualizationManual with L = 256.

if nargin < 2 || isempty(L), L = 8; end
A = double(A);
if ~ismatrix(A) || isempty(A) || numel(A) > 144
    error('ImageLab:invalidMatrix', 'Use a matrix of at most 12x12 values for the step-by-step view.');
end
if L < 2 || L > 16 || L ~= round(L)
    error('ImageLab:invalidParameter', 'Use between 2 and 16 grey levels.');
end
if any(A(:) ~= round(A(:))) || any(A(:) < 0) || any(A(:) > L - 1)
    error('ImageLab:invalidMatrix', 'Every value must be a whole number between 0 and %d (L = %d levels).', L - 1, L);
end
N = numel(A);
counts = accumarray(A(:) + 1, 1, [L 1])';
p = counts / N;
cdf = cumsum(p);
mapping = round((L - 1) * cdf);
out = mapping(A + 1);
S = struct('L', L, 'N', N, 'input', ilab_mat(A), 'counts', counts, 'p', p, 'cdf', cdf, ...
    'mapping', mapping, 'output', ilab_mat(out), ...
    'countsAfter', accumarray(out(:) + 1, 1, [L 1])');
end
