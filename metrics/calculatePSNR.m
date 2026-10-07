function value = calculatePSNR(A, ref)
%CALCULATEPSNR Peak signal-to-noise ratio in decibels.
%       PSNR = 10 * log10( MAX^2 / MSE )      (MAX = 1 for [0,1] images)
%   Higher is better. ~20 dB poor, ~30 dB good, > 40 dB excellent.
%   Identical images give Inf.

A = toDouble(A);
ref = toDouble(ref);
if hasIPT()
    value = psnr(A, ref);
else
    value = 10 * log10(1 / calculateMSE(A, ref));
end
end
