function J = histogramEqualization(I)
%HISTOGRAMEQUALIZATION Global histogram equalisation - TOOLBOX version.
%       J = histeq(I, 256);
%   Colour images are equalised on the brightness (V) channel only so the
%   colours do not shift. See histogramEqualizationManual for the algorithm.

if hasIPT()
    J = applyToLuminance(@(V) histeq(V, 256), I);
else
    J = applyToLuminance(@(V) histogramEqualizationManual(V), I);
end
end
