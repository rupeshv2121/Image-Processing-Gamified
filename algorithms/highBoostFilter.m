function [G, mask] = highBoostFilter(I, boost, k)
%HIGHBOOSTFILTER High-boost filtering (Gonzalez & Woods).
%       blurred = mean filter of I (k-by-k)
%       mask    = I - blurred               (high-pass detail)
%       G       = I + boost * mask
%
%   boost = 1  -> unsharp masking
%   boost > 1  -> high-boost filtering (detail amplified more strongly)
%   Equivalent form: G = (boost+1)*I - boost*blurred.

if nargin < 2 || isempty(boost), boost = 2; end
if nargin < 3 || isempty(k), k = 3; end
if boost < 1, error('ImageLab:invalidParameter', 'The boost factor must be >= 1.'); end
I = toDouble(I);
blurred = meanFilter(I, k);
mask = I - blurred;
G = min(max(I + boost * mask, 0), 1);
end
