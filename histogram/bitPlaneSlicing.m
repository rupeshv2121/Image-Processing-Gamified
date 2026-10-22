function [planes, R] = bitPlaneSlicing(I, keep)
%BITPLANESLICING Split an 8-bit image into its 8 bit planes.
%   [planes, R] = bitPlaneSlicing(I, keep)
%   planes{k} - logical image of bit k (k = 1 least significant ... 8 most)
%   keep      - the bit planes used for the reconstruction R (default 5:8)
%   R         - sum of plane_k * 2^(k-1) over the kept planes, scaled to [0,1]
%
%   The high-order planes (7, 8) hold most of the visually significant
%   data; the low-order planes look like noise. Keeping only the top 4
%   planes already gives an acceptable image - the idea behind compression.
%       b = bitget(uint8(255*G), k);     % plane k

if nargin < 2 || isempty(keep), keep = 5:8; end
G = toUint8(toGray(I));
planes = cell(1, 8);
R = zeros(size(G));
for k = 1:8
    planes{k} = logical(bitget(G, k));
    if ismember(k, keep)
        R = R + double(planes{k}) * 2^(k - 1);
    end
end
R = R / 255;
end
