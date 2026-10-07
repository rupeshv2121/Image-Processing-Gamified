function S = neighborhoodStack(I, kh, kw, mode)
%NEIGHBORHOODSTACK Collect every k-by-k neighbourhood of a 2-D image.
%   S = neighborhoodStack(I, kh, kw, mode) returns an h-by-w-by-(kh*kw)
%   array where S(i,j,:) holds the neighbourhood of pixel (i,j) in the same
%   order as window(:) (column-major).
%
%   This is the vectorised building block for the fast (non-loop) versions
%   of the median, min, max and order-statistic filters:
%       median(S,3)  -> median filter
%       min(S,[],3)  -> min filter
%       sort(S,3)    -> any rank (order-statistic) filter

if nargin < 3 || isempty(kw), kw = kh; end
if nargin < 4 || isempty(mode), mode = 'replicate'; end
if ~ismatrix(I)
    error('ImageLab:invalidImage', 'neighborhoodStack expects a 2-D image.');
end

[h, w] = size(I);
pr = floor(kh / 2);
pc = floor(kw / 2);
P = padImage(I, pr, pc, mode);

S = zeros(h, w, kh * kw, 'like', I);
n = 0;
for dc = 0:kw-1          % columns outer, rows inner = column-major order
    for dr = 0:kh-1
        n = n + 1;
        S(:,:,n) = P(1+dr:h+dr, 1+dc:w+dc);
    end
end
end
