function props = regionProperties(L)
%REGIONPROPERTIES Area, centroid, bounding box and perimeter of each region.
%   Manual equivalent of regionprops(L, 'Area', 'Centroid', 'BoundingBox',
%   'Perimeter'). L is a label image (0 = background).
%   Perimeter is counted as the number of boundary pixels.

n = max(L(:));
props = repmat(struct('label', 0, 'area', 0, 'centroidX', 0, 'centroidY', 0, ...
    'bboxX', 0, 'bboxY', 0, 'bboxWidth', 0, 'bboxHeight', 0, ...
    'perimeter', 0, 'equivDiameter', 0), n, 1);
if n == 0, props = props([]); return; end

B = extractBoundary(L > 0);
for k = 1:n
    [r, c] = find(L == k);
    region = L == k;
    props(k).label = k;
    props(k).area = numel(r);
    props(k).centroidX = mean(c);
    props(k).centroidY = mean(r);
    props(k).bboxX = min(c);
    props(k).bboxY = min(r);
    props(k).bboxWidth = max(c) - min(c) + 1;
    props(k).bboxHeight = max(r) - min(r) + 1;
    props(k).perimeter = nnz(B & region);
    props(k).equivDiameter = sqrt(4 * numel(r) / pi);
end
end
