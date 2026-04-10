import { motion } from "motion/react";

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex-1 flex flex-col relative"
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}