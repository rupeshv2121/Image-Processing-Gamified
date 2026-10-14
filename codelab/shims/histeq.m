function J = histeq(I, varargin)
%HISTEQ Code Lab stand-in for the toolbox histeq (ImageLab's manual version).
J = histogramEqualizationManual(toGray(I));
if isa(I, 'uint8'), J = toUint8(J); end
end
