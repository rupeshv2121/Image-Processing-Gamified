function J = histogramEqualization(I)
%HISTOGRAMEQUALIZATION Global histogram equalisation - TOOLBOX version.
%       J = histeq(I, 256);
%   RGB images are converted to HSI and equalised on the intensity channel.

if hasIPT()
    J = applyToIntensity(@(V) histeq(V, 256), I);
else
    J = applyToIntensity(@histogramEqualizationManual, I);
end
end
