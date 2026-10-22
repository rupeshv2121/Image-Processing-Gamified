function q = imageQuality(A, ref)
%IMAGEQUALITY MSE and PSNR of A against the reference in one struct.

q = struct('mse', calculateMSE(A, ref), ...
           'psnr', calculatePSNR(A, ref));
end
