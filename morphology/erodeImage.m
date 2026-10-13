function J = erodeImage(I, SE)
%ERODEIMAGE Morphological erosion of a binary or grayscale image.
%   J = erodeImage(I, SE) - like imerode(I, SE).
%
%   Erosion takes the MINIMUM of the pixels covered by the structuring
%   element B placed at each pixel:
%
%       (A ⊖ B)(x, y) = min { A(x + s, y + t) : (s, t) in B }
%
%   Binary image: a pixel stays 1 only if B fits completely inside the
%   object, so objects shrink, thin bridges break and specks smaller than B
%   disappear. Grayscale: bright details smaller than B are removed and the
%   image becomes darker.
%
%   Pixels outside the image are treated as +Inf, so the border never
%   causes erosion (the same convention as imerode).

SE = validateSE(SE);
isBinary = islogical(I);
if hasIPT()
    J = imerode(I, SE);
    return
end

X = double(I);
[h, w, nc] = size(X);
[kh, kw] = size(SE);
pr = (kh - 1) / 2;
pc = (kw - 1) / 2;
[dr, dc] = find(SE);                     % offsets of the 1s in the element
J = zeros(h, w, nc);
for c = 1:nc
    P = inf(h + 2*pr, w + 2*pc);
    P(pr+1:pr+h, pc+1:pc+w) = X(:,:,c);
    E = inf(h, w);
    for n = 1:numel(dr)                  % vectorised over all pixels:
        E = min(E, P(dr(n):dr(n)+h-1, dc(n):dc(n)+w-1));   % one shift per SE element
    end
    J(:,:,c) = E;
end
if isBinary, J = J > 0; end
end
