function B = extractBoundary(BW)
%EXTRACTBOUNDARY Outline of the regions in a binary image.
%   A pixel is on the boundary if it is foreground and at least one of its
%   8 neighbours is background (outside the image counts as background) -
%   the definition of a region's boundary from the pixel relationships.

BW = logical(BW);
hasBackgroundNeighbour = any(neighborhoodStack(double(BW), 3, 3, 'zero') == 0, 3);
B = BW & hasBackgroundNeighbour;
end
