function [level, effectiveness] = graythresh(I)
%GRAYTHRESH Code Lab stand-in for the toolbox graythresh (Otsu's method).
[~, level, effectiveness] = otsuThreshold(toGray(I));
end
