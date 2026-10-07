function d = pixelDistances(p, q)
%PIXELDISTANCES Distance measures between pixels p = [x y] and q = [s t].
%   Euclidean    De = sqrt((x-s)^2 + (y-t)^2)
%   City-block   D4 = |x-s| + |y-t|          (pixels with D4 = 1 are N4(p))
%   Chessboard   D8 = max(|x-s|, |y-t|)      (pixels with D8 = 1 are N8(p))

dx = abs(p(1) - q(1));
dy = abs(p(2) - q(2));
d = struct('euclidean', sqrt(dx^2 + dy^2), ...
           'cityBlock', dx + dy, ...
           'chessboard', max(dx, dy));
end
