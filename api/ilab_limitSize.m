function [I, resized] = ilab_limitSize(I, maxSide)
%ILAB_LIMITSIZE Keep images at most maxSide (default 640) px on the longest side,
%   so the manual loop implementations stay interactive.
if nargin < 2, maxSide = 640; end
[h, w, ~] = size(I);
resized = max(h, w) > maxSide;
if resized
    s = maxSide / max(h, w);
    I = resizeImage(I, round(h * s), round(w * s));
end
end
