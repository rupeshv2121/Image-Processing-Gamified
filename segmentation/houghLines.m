function lines = houghLines(BW, theta, rho, peaks, fillGap, minLength)
%HOUGHLINES Line segments of the edge image that belong to Hough peaks.
%   lines = houghLines(BW, theta, rho, peaks, fillGap, minLength) returns a
%   struct array with point1 / point2 ([x y], 1-based), theta, rho, length.
%
%   For every peak the edge pixels lying on the line (within half a pixel)
%   are sorted along it. Gaps of at most fillGap pixels are bridged - this
%   is the EDGE LINKING step - and segments shorter than minLength dropped.
%       lines = houghlines(BW, theta, rho, peaks, 'FillGap', 5, 'MinLength', 20);

if nargin < 5 || isempty(fillGap), fillGap = 5; end
if nargin < 6 || isempty(minLength), minLength = 20; end
[r, c] = find(BW);
x = c - 1; y = r - 1;
lines = struct('point1', {}, 'point2', {}, 'theta', {}, 'rho', {}, 'length', {});
for p = 1:size(peaks, 1)
    th = theta(peaks(p, 2)); rh = rho(peaks(p, 1));
    on = abs(x * cosd(th) + y * sind(th) - rh) <= 0.5;
    if nnz(on) < 2, continue; end
    px = x(on); py = y(on);
    t = -px * sind(th) + py * cosd(th);             % position along the line
    [t, order] = sort(t);
    px = px(order); py = py(order);
    breaks = [0; find(diff(t) > fillGap); numel(t)];
    for s = 1:numel(breaks) - 1
        a = breaks(s) + 1; b = breaks(s + 1);
        len = hypot(px(b) - px(a), py(b) - py(a));
        if len >= minLength
            lines(end + 1) = struct('point1', [px(a) py(a)] + 1, 'point2', [px(b) py(b)] + 1, ... %#ok<AGROW>
                'theta', th, 'rho', rh, 'length', len);
        end
    end
end
end
