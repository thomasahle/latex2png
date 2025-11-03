export const latexExamples = [
  // Recurrence relation example
  String.raw`f(1,m) &= \exp(-m), \\
f(2,m) &= \exp(-2m)
        + (m + m^2)\exp(-3m), \\
f(3,m) &= \exp(-3m)
        + (2m + 4m^2)\exp(-4m)
        + \left(\frac{1}{2}m^2 + 2m^3 + \frac{9}{4}m^4\right)\exp(-5m), \\
f(4,m) &= \exp(-4m)
        + (3m + 9m^2)\exp(-5m)
        + (-2m^2 + 6m^3 + 16m^4)\exp(-6m)
        + \left(\frac16m^3 - \frac72m^4 + \frac{16}3m^5 + \frac{64}{9}m^6\right)\exp(-7m), \\
f(5,m) &= ?
`,
  // Cross product with determinant
  String.raw`\mathbf{V}_1 \times \mathbf{V}_2 =
\begin{vmatrix}
   \mathbf{i} & \mathbf{j} & \mathbf{k} \\
   \frac{\partial X}{\partial u} & \frac{\partial Y}{\partial u} & 0 \\
   \frac{\partial X}{\partial v} & \frac{\partial Y}{\partial v} & 0
\end{vmatrix}`,
  
  // Binomial probability
  String.raw`P(E) = {n \choose k} p^k (1-p)^{n-k}`,
  
  // Nested fractions
  String.raw`\frac{1}{
  \Bigl(\sqrt{\phi\sqrt{5}} - \phi\Bigr)
  e^{\frac{2}{5}\pi}
}
=
1 +
\frac{e^{-2\pi}}{
  1 +
  \frac{e^{-4\pi}}{
    1 +
    \frac{e^{-6\pi}}{
      1 +
      \frac{e^{-8\pi}}{1 + \cdots}
    }
  }
}`,
  // Infinite product
  String.raw`1 &+ \frac{q^2}{1-q} \\
  &+ \frac{q^6}{(1-q)(1-q^2)} \\
  &+ \cdots \\
  &= \prod_{j=0}^{\infty} \frac{1}{(1-q^{5j+2})(1-q^{5j+3})} \\
  &\quad \text{for } |q| < 1.`,
  
  // Chemistry equation
  String.raw`\ce{CO2 + C -> 2 CO}`,
  
  // Physics with braket notation
  String.raw`\bra{\psi} \hat{H} \ket{\phi} = E \braket{\psi|\phi}`,
  
  // Colored equation with cancellation
  String.raw`\color{blue}{x^2} + \color{red}{\cancel{2xy}} + y^2 = (x+y)^2 - \cancel{2xy}`,
  
  // Bold symbols
  String.raw`\boldsymbol{\nabla} \times \boldsymbol{E} = -\frac{\partial \boldsymbol{B}}{\partial t}`
];
