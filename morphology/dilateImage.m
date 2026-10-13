function J = dilateImage(I, SE)
%DILATEIMAGE Morphological dilation of a binary or grayscale image.
%   J = dilateImage(I, SE) - like imdilate(I, SE).
%
%   Dilation takes the MAXIMUM over the REFLECTED structuring element:
%
%       (A ⊕ B)(x, y) = max { A(x - s, y - t) : (s, t) in B }
%
%   Binary image: a pixel becomes 1 if the reflected B placed there touches
%   the object at all, so objects grow, small gaps and holes are bridged and
%   broken characters join up. Grayscale: bright regions expand.
%
%   Pixels outside the image are treated as -Inf (the imdilate convention).

SE = validateSE(SE);
isBinary = islogical(I);
if hasIPT()
    J = imdilate(I, SE);
    return
end

X = double(I);
[h, w, nc] = size(X);
R = rot90(SE, 2);                        % reflection of B about its origin
[kh, kw] = size(R);
pr = (kh - 1) / 2;
pc = (kw - 1) / 2;
[dr, dc] = find(R);
J = zeros(h, w, nc);
for c = 1:nc
    P = -inf(h + 2*pr, w + 2*pc);
    P(pr+1:pr+h, pc+1:pc+w) = X(:,:,c);
    D = -inf(h, w);
    for n = 1:numel(dr)
        D = max(D, P(dr(n):dr(n)+h-1, dc(n):dc(n)+w-1));
    end
    J(:,:,c) = D;
end
if isBinary, J = J > 0; end
end
