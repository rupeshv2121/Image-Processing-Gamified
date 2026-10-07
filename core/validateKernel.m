function K = validateKernel(K)
%VALIDATEKERNEL Check that K is a usable spatial-filter kernel.
%   The kernel must be a real, finite, non-empty 2-D matrix with odd
%   dimensions (so it has a centre element) no larger than 31x31.

if ~isnumeric(K) || isempty(K) || ~ismatrix(K) || ~isreal(K) || any(~isfinite(K(:)))
    error('ImageLab:invalidKernel', ...
        'The kernel must be a non-empty matrix of finite real numbers.');
end
[kh, kw] = size(K);
if mod(kh, 2) == 0 || mod(kw, 2) == 0 || kh > 31 || kw > 31
    error('ImageLab:invalidKernel', ...
        'Kernel dimensions must be odd and at most 31 (got %dx%d).', kh, kw);
end
K = double(K);
end
