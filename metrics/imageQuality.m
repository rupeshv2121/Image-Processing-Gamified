function q = imageQuality(A, ref)
%IMAGEQUALITY MSE, PSNR and SSIM of A against the reference in one struct.

q = struct('mse', calculateMSE(A, ref), ...
           'psnr', calculatePSNR(A, ref), ...
           'ssim', calculateSSIM(A, ref));
end
