function J = addErlangNoise(I, a, b)
%ADDERLANGNOISE Additive Erlang (gamma) noise (Gonzalez & Woods, noise models).
%   J = addErlangNoise(I, a, b) adds z with the Erlang PDF (b a positive integer)
%
%       p(z) = a^b z^(b-1) exp(-a z) / (b - 1)!   for z >= 0
%       mean = b / a,   variance = b / a^2
%
%   Appears in laser imaging. An Erlang variable is the sum of b independent
%   exponential variables with rate a:  z = -(1/a) * sum ln(U_i).

if nargin < 2 || isempty(a), a = 20; end
if nargin < 3 || isempty(b), b = 2; end
b = round(b);
if a <= 0 || b < 1, error('ImageLab:invalidParameter', 'a must be > 0 and b a positive integer.'); end
I = toDouble(I);
z = zeros(size(I));
for k = 1:b
    z = z - log(1 - rand(size(I))) / a;
end
J = min(max(I + z, 0), 1);
end
