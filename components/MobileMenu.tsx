'use client'

import { useState } from "react";
import { motion } from "framer-motion";
import { RiMenu2Line, RiCloseFill } from "react-icons/ri";
import { IoChevronDown} from "react-icons/io5"
import { Menus } from "@/lib/utils";
import { useAppContext } from "@/context";
import Link from "next/link";

export const MobMenu = () => {
  const {isOpen, setIsOpen} = useAppContext()
  const [clicked, setClicked] = useState<null|number>(null);
  const toggleDrawer = () => {
    setIsOpen(!isOpen);
    setClicked(null);
  };

  const subMenuDrawer = {
    enter: {
      height: "auto",
      overflow: "hidden",
    },
    exit: {
      height: 0,
      overflow: "hidden",
    },
  };

  return (
    <div className="">
      <button className="lg:hidden relative z-999 " onClick={toggleDrawer}>
        {isOpen ? <RiCloseFill className="w-7 h-7 mt-1" /> : <RiMenu2Line className="w-6 h-6 mt-1" />}
      </button>
      <motion.div
        className="fixed z-50 left-0 right-0 top-24 overflow-y-auto h-full bg-background dark:bg-background-dark backdrop-blur p-6 pb-20"
        initial={{ x: "-100%" }}
        animate={{ x: isOpen ? "0%" : "-100%" }}
      >
        <ul>
          {Menus.map(({ name, subMenu, link }, i) => {
            const isClicked = clicked === i;
            const hasSubMenu = subMenu?.length;
            return (
              <li key={name} className="">
                <span
                  className="flex-center-between p-4 hover:bg-white/5 rounded-md cursor-pointer relative"
                  onClick={() => setClicked(isClicked ? null : i)}
                >
                  {link? <Link href={link}>{name}</Link>:name}
                  {hasSubMenu && (
                    <IoChevronDown
                      className={`ml-auto ${isClicked && "rotate-180"} `}
                    />
                  )}
                </span>
                {hasSubMenu && (
                  <motion.ul
                    initial="exit"
                    animate={isClicked ? "enter" : "exit"}
                    variants={subMenuDrawer}
                    className="ml-5"
                  >
                    {subMenu.map(({ name, icon: Icon, link }) => (
                      <li
                        key={name}
                        className="p-2 flex-center hover:bg-white/5 rounded-md gap-x-2 cursor-pointer"
                      >
                        <Icon size={17} />
                        {link? <Link href={link}>{name}</Link>:name}
                      </li>
                    ))}
                  </motion.ul>
                )}
              </li>
            );
          })}
        </ul>
      </motion.div>
    </div>
  );
}