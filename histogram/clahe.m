function J = clahe(I, numTiles, clipLimit)
%CLAHE Contrast-Limited Adaptive Histogram Equalisation - TOOLBOX version.
%       J = adapthisteq(I, 'NumTiles', [8 8], 'ClipLimit', 0.01);
%   Equalises small regions separately (local contrast) and limits the
%   amplification so noise is not exaggerated. Colour images are processed
%   on the V channel.

if nargin < 2 || isempty(numTiles), numTiles = [8 8]; end
if nargin < 3 || isempty(clipLimit), clipLimit = 0.01; end
if isscalar(numTiles), numTiles = [numTiles numTiles]; end
if hasIPT()
    J = applyToLuminance(@(V) adapthisteq(V, 'NumTiles', numTiles, 'ClipLimit', clipLimit), I);
else
    J = applyToLuminance(@(V) claheManual(V, numTiles, clipLimit), I);
end
end
