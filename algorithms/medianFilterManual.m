function J = medianFilterManual(I, k)
%MEDIANFILTERMANUAL Median filter written with loops and sort (educational).
%   For each pixel:
%     1. extract the k-by-k neighbourhood
%     2. convert it into a vector
%     3. sort the vector
%     4. pick the middle element (the median)

if nargin < 2 || isempty(k), k = 3; end
validateKernelSize(k);
I = toDouble(I);
[h, w, nc] = size(I);
r = floor(k / 2);
mid = (k*k + 1) / 2;                    % position of the median after sorting
J = zeros(h, w, nc);

for c = 1:nc
    P = padImage(I(:,:,c), r, r, 'symmetric');
    for i = 1:h
        for j = 1:w
            window = P(i:i+2*r, j:j+2*r);     % 1. neighbourhood
            values = window(:);               % 2. vector
            sortedWindow = sort(values);      % 3. sort
            J(i,j,c) = sortedWindow(mid);     % 4. middle value
        end
    end
end
end
