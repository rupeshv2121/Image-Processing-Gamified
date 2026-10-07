function validateKernelSize(k)
%VALIDATEKERNELSIZE Check that a neighbourhood size is an odd integer 1..31.
%   Odd sizes are required so that the window has a well-defined centre pixel.

if ~isnumeric(k) || ~isscalar(k) || ~isfinite(k) || k ~= round(k) || ...
        k < 1 || k > 31 || mod(k, 2) == 0
    error('ImageLab:invalidKernelSize', ...
        'Kernel size must be an odd integer between 1 and 31 (got %s).', ...
        mat2str(k));
end
end
