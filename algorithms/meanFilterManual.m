function J = meanFilterManual(I, k)
%MEANFILTERMANUAL Mean filter written with nested loops (educational).
%   J = meanFilterManual(I, k) gives the same result as meanFilter but shows
%   every step of the algorithm explicitly:
%
%     for each pixel (i,j)
%         window  = k-by-k neighbourhood centred on (i,j)
%         J(i,j)  = sum(window) / k^2
%     end
%
%   Borders are handled by replicating the edge pixels.

if nargin < 2 || isempty(k), k = 3; end
validateKernelSize(k);
I = toDouble(I);
[h, w, nc] = size(I);
r = floor(k / 2);                       % neighbourhood radius
J = zeros(h, w, nc);

for c = 1:nc
    P = padImage(I(:,:,c), r, r, 'replicate');
    for i = 1:h
        for j = 1:w
            window = P(i:i+2*r, j:j+2*r);     % extract neighbourhood
            J(i,j,c) = sum(window(:)) / (k*k);% average of the window
        end
    end
end
end
