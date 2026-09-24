## Derivatives
### Def. Derivative via Limits
$$
\lim_{ \Delta z \to 0 } \frac{f(z_{0} + \Delta z) - f(z_{0})}{\Delta z}
$$

##### Ex. Computing Derivatives via limit definition

### Def. Analytic Function
A function is analytic on an **open set** $\Omega$ if it is differentiable at all points on $\Omega$
- so things are analytic on specific sets $\Omega$ rather than analytic everywhere

#####  Ex. A surprising analytic function
$$
f(z)=(\frac{z+1}{z-i})^{10}
$$
turns out to be analytic on the set $\mathbb{C} \setminus \{ i \}$ 
because **we can drop points and still have our set be open**

#####  Ex. 
$$
f(z)=e^z\quad\text{find }f'
$$
Solution:
$$
\begin{align}
\lim_{ \Delta z \to 0 }  \frac{e^{z+\Delta z } + e^{-z}}{\Delta z}  & = e^z \lim_{ \Delta z \to 0 }  \frac{e^\Delta z -1}{\Delta z}  \\
&= e^z \lim \frac{(e^{\Delta x}(\cos \Delta y) + i \sin \Delta y) - 1}{\Delta z} \\
&= \dots  \text{figure this out later}
\end{align}
$$

