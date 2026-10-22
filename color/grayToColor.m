function [J, curves] = grayToColor(I, frequency, phases)
%GRAYTOCOLOR Pseudocolour by three independent intensity-to-colour transformations.
%   [J, curves] = grayToColor(I, frequency, phases)
%   Every grey level r is sent through three different functions, one per
%   primary (Gonzalez & Woods use phase-shifted sinusoids):
%       R = |sin(2*pi*frequency*r + phases(1))|   (same for G and B)
%   Grey levels where the three curves differ get very different colours,
%   so material with a particular intensity (e.g. explosives in an X-ray
%   bag scan) stands out.
%   curves - 256-by-3 transfer functions (for plotting)

if nargin < 2 || isempty(frequency), frequency = 1; end
if nargin < 3 || isempty(phases), phases = [0, pi / 3, 2 * pi / 3]; end
G = toGray(I);
r = (0:255)' / 255;
curves = zeros(256, 3);
J = zeros([size(G) 3]);
for c = 1:3
    curves(:, c) = abs(sin(2 * pi * frequency * r + phases(c)));
    J(:,:,c) = abs(sin(2 * pi * frequency * G + phases(c)));
end
end
