function J = openImage(I, SE)
%OPENIMAGE Morphological opening: erosion followed by dilation.
%   J = openImage(I, SE) - like imopen(I, SE).
%
%       A ∘ B = (A ⊖ B) ⊕ B
%
%   Opening removes objects (and bright details) smaller than B and smooths
%   contours by cutting thin protrusions, while objects larger than B keep
%   their size. It is idempotent: opening twice changes nothing.

J = dilateImage(erodeImage(I, SE), SE);
end
