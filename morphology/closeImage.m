function J = closeImage(I, SE)
%CLOSEIMAGE Morphological closing: dilation followed by erosion.
%   J = closeImage(I, SE) - like imclose(I, SE).
%
%       A • B = (A ⊕ B) ⊖ B
%
%   Closing fills small holes and narrow gaps (dark details smaller than B)
%   and joins nearby objects, while large objects keep their size. It is
%   the dual of opening and is also idempotent.

J = erodeImage(dilateImage(I, SE), SE);
end
